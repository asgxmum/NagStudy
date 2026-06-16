import { useState } from "react";

// Lucide-style eye icons (inline so we don't pull a dependency).
const EyeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a16.8 16.8 0 0 1-2.6 3.4M6.1 6.1A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3.4-.6" />
  </svg>
);

// Drop-in replacement for <input type="password"> with a natural show/hide eye toggle.
// Forwards every prop (className, value, onChange, placeholder…) straight to the input.
export default function PasswordInput({ className, style, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "block" }}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
        style={{ ...style, width: "100%", paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "#9AA0B0",
          display: "inline-flex",
          lineHeight: 0,
        }}
      >
        {show ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  );
}
