"use client";

import React, { useEffect, useRef } from "react";

/** No character/height cap: pasted text and controlled updates both resize the field. */
export default function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    resize();
    // Reflow long comments when the dialog/viewport width changes too.
    let width = element.getBoundingClientRect().width;
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} style={{ ...props.style, overflowY: "hidden", resize: "none" }} />;
}
