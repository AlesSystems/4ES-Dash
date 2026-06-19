import { ImageResponse } from 'next/og';

// Next.js file-convention: this module auto-wires <link rel="icon"> in <head>.
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons#icon

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

/**
 * Generates the browser tab icon (favicon) reproducing the brand amber-dot mark:
 * a filled amber circle (#e8a05c) with a small centered hole, matching the
 * AppHeader wordmark logo.
 *
 * Static palette — one fixed color, no CSS variables (file-based icon cannot
 * follow the light/dark toggle).
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      {/* Outer amber filled circle */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: '#e8a05c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner centered hole — darker/transparent to reproduce the brand mark */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#1a1510',
          }}
        />
      </div>
    </div>,
    {
      ...size,
    },
  );
}
