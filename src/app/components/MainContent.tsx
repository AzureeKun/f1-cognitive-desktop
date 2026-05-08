import React, { useState } from "react";
import { CognitiveScore } from "./CognitiveScore";
import { TelemetryCharts } from "./TelemetryCharts";

export function MainContent() {
  const [focusStatus, setFocusStatus] = useState<"Focused" | "Distracted">("Focused");
  
  // Toggle status every 5 seconds for demonstration
  React.useEffect(() => {
    const interval = setInterval(() => {
      setFocusStatus(prev => prev === "Focused" ? "Distracted" : "Focused");
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-4">
      <TelemetryCharts focusStatus={focusStatus} />
    </div>
  );
}
