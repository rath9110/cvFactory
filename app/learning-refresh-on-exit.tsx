"use client";

import { useEffect } from "react";
import { triggerLearningRefreshOnExit } from "@/lib/learning-trigger";

/**
 * Fires the learning refresh when the tab goes away, if nothing else fired it
 * first. Mounted once in the root layout; renders nothing.
 *
 * `pagehide` and a hidden `visibilitychange` are used rather than
 * `beforeunload`: they are the two the mobile browsers actually deliver when an
 * app is backgrounded or a tab is discarded.
 */
export default function LearningRefreshOnExit() {
  useEffect(() => {
    const onHide = () => triggerLearningRefreshOnExit();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") triggerLearningRefreshOnExit();
    };

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
