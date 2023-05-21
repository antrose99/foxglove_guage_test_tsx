import { PanelExtensionContext, RenderState, MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import { useLayoutEffect, useEffect, useState } from "react";
import produce from "immer";
import { set } from "lodash";
import { v4 as uuidv4 } from "uuid";

import ReactDOM from "react-dom";

var val: number = 0;
type Float32 = {
  data: number;
}

type State = {
  general: {
    value_topic: string;
    min_value: number;
    max_value: number;
    gradient: [string, string];
    description: string;
    unit: string;
    precision: number;
    inverse_direction: boolean;
  };
};

function CFSGuage({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [messages, setMessages] = useState<readonly MessageEvent<unknown>[] | undefined>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();


  const [state, setState] = useState<State>(() => {
    const partialState = context.initialState as Partial<State>;
    return {
      general: {
        value_topic: partialState.general?.value_topic ?? "",
        min_value: partialState.general?.min_value ?? 0,
        max_value: partialState.general?.max_value ?? 1,
        gradient: partialState.general?.gradient ?? ["#0000ff", "#ff00ff"],
        description: partialState.general?.description ?? "",
        unit: partialState.general?.unit ?? "",
        precision: partialState.general?.precision ?? 1,
        inverse_direction: partialState.general?.inverse_direction ?? false,
      },
    };
  });


  useEffect(() => {
    context.saveState(state);
    context.updatePanelSettingsEditor({
      nodes: {
        general: {
          label: "General",
          fields: {
            value_topic: {
              label: "Message Path",
              input: "messagepath",
              value: state.general.value_topic,
            },
            min_value: {
              label: "Min",
              input: "number",
              value: state.general.min_value,
            },
            max_value: {
              label: "Max",
              input: "number",
              value: state.general.max_value,
            },
            gradient: {
              label: "Gradient",
              input: "gradient",
              value: state.general.gradient,
            },
            description: {
              label: "Description",
              input: "string",
              value: state.general.description,
            },
            unit: {
              label: "Unit",
              input: "string",
              value: state.general.unit,
            },
            precision: {
              label: "Precision",
              input: "number",
              value: state.general.precision,
            },
            inverse_direction: {
              label: "Inverse Direction",
              input: "boolean",
              value: state.general.inverse_direction,
            },
          },
        }, 
        },
  
      actionHandler: (action: SettingsTreeAction) => {
        switch (action.action) {
          case "update":
            const { path, value } = action.payload;
            
            setState(produce((draft) => set(draft, path, value)));

            let sub: string = "";
            if (path[1] == "value_topic") {
              sub = value as string;
              context.subscribe([""]);
              context.subscribe([sub]);
            }

            break;
        }
      },    

    });

  }, [context, state]);


  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState: RenderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, studio shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render.
      setRenderDone(() => done);

      // We may have new topics - since we are also watching for messages in the current frame, topics may not have changed
      // It is up to you to determine the correct action when state has not changed.
      // currentFrame has messages on subscribed topics since the last render call
      setMessages(renderState.currentFrame);
  
    };


  
    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // This corresponds to the _currentFrame_ field of render state.
    context.watch("currentFrame");


    // subscribe to some topics, you could do this within other effects, based on input fields, etc
    // Once you subscribe to topics, currentFrame will contain message events from those topics (assuming there are messages).
    context.subscribe([state.general.value_topic]);

  }, [context]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);


  function getConicGradient(width: number, height: number, gaugeAngle: number) {
    let colorStops: { color: string; location: number }[];

    colorStops = [{ color: state.general.gradient[0], location: 0 }, { color: state.general.gradient[1], location: 1 }];

    return `conic-gradient(from ${-Math.PI / 2 + gaugeAngle}rad at 50% ${
      100 * (width / 2 / height)
    }%, ${colorStops
      .map((stop) => `${stop.color} ${stop.location * 2 * (Math.PI / 2 - gaugeAngle)}rad`)
      .join(",")}, ${colorStops[0]!.color})`;
  }

  useEffect(() => {
    if (messages){
      for (const element of messages) {
        if (element) {
          const topic = element.topic as string;
          const latestMsg = element.message as Float32 | undefined;
          if (latestMsg) {
            if (topic == state.general.value_topic) {
              val = latestMsg.data;
            }
          }
        }
      }
      }
  }, [messages]);
  var rawValue = val;
  var minValue = state.general.min_value;
  var maxValue = state.general.max_value;
  if (state.general.inverse_direction) {
    rawValue = -1 * val;
    minValue = -state.general.max_value;
    maxValue = -state.general.min_value;
  }
  const scaledValue =
    (Math.max(minValue, Math.min(rawValue, maxValue)) - minValue) / (maxValue - minValue);
  const outOfBounds = rawValue < minValue || rawValue > maxValue;

  const padding = 0.1;
  const centerX = 0.5 + padding;
  const centerY = 0.5 + padding;
  const gaugeAngle = -Math.PI / 8;
  const radius = 0.5;
  const innerRadius = 0.4;
  const width = 1 + 2 * padding;
  const height =
    Math.max(
      centerY - radius * Math.sin(gaugeAngle),
      centerY - innerRadius * Math.sin(gaugeAngle),
    ) + padding;
  const needleThickness = 8;
  const needleExtraLength = 0.05;
  const [clipPathId] = useState(() => `gauge-clip-path-${uuidv4()}`);
  const precision = Math.ceil(Math.abs(state.general.precision))

  var desc;
  if (state.general.description != "") {
    desc = state.general.description + ":";
  } else {
    desc = "";
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
        alignItems: "center",
        overflow: "hidden",
        padding: 8,
      }}
    >
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${width} / ${height}`,
            margin: "0 auto",
            transform: "scale(1)", // Work around a Safari bug: https://bugs.webkit.org/show_bug.cgi?id=231849
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: getConicGradient(width, height, gaugeAngle),
              clipPath: `url(#${clipPathId})`,
              opacity: 1,
            }}
          />

          <p style={{
              fontSize: "14px",
          }}><center><b>{desc} {val.toFixed(precision)} {state.general.unit}</b></center></p>
          

          <div
            style={{
              backgroundColor: outOfBounds ? "orange" : "white",
              width: needleThickness,
              height: `${(100 * (radius + needleExtraLength)) / height}%`,
              border: "2px solid black",
              borderRadius: needleThickness / 2,
              position: "absolute",
              bottom: `${100 * (1 - centerY / height)}%`,
              left: "50%",
              transformOrigin: "bottom left",
              margin: "0 auto",
              transform: [
                `scaleZ(1)`,
                `rotate(${
                  -Math.PI / 2 + gaugeAngle + scaledValue * 2 * (Math.PI / 2 - gaugeAngle)
                }rad)`,
                `translateX(${-needleThickness / 2}px)`,
                `translateY(${needleThickness / 2}px)`,
              ].join(" "),
              display: Number.isFinite(scaledValue) ? "block" : "none",
            }}
          />
        </div>
        <svg style={{ position: "absolute" }}>
          <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
            <path
              transform={`scale(${1 / width}, ${1 / height})`}
              d={[
                `M ${centerX - radius * Math.cos(gaugeAngle)},${
                  centerY - radius * Math.sin(gaugeAngle)
                }`,
                `A 0.5,0.5 0 ${gaugeAngle < 0 ? 1 : 0} 1 ${
                  centerX + radius * Math.cos(gaugeAngle)
                },${centerY - radius * Math.sin(gaugeAngle)}`,
                `L ${centerX + innerRadius * Math.cos(gaugeAngle)},${
                  centerY - innerRadius * Math.sin(gaugeAngle)
                }`,
                `A ${innerRadius},${innerRadius} 0 ${gaugeAngle < 0 ? 1 : 0} 0 ${
                  centerX - innerRadius * Math.cos(gaugeAngle)
                },${centerY - innerRadius * Math.sin(gaugeAngle)}`,
                `Z`,
              ].join(" ")}
            />
          </clipPath>
        </svg>
      </div>
    </div>
  );
}

export function initCFSGuagePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<CFSGuage context={context} />, context.panelElement);
}
