import PropTypes from "prop-types";

/**
 * Zavorth brand mark.
 * A protective eye wrapped in a coiled frame to signal vigilance,
 * routing intelligence, and controlled power.
 */
export default function ZavorthGatewayLogo({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 4C14.2 4 7.1 10 5 20.2C7.7 31 14.8 39.1 24 44C33.2 39.1 40.3 31 43 20.2C40.9 10 33.8 4 24 4Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M10.5 24C14.1 16.8 18.6 13.2 24 13.2C29.4 13.2 33.9 16.8 37.5 24C33.9 31.2 29.4 34.8 24 34.8C18.6 34.8 14.1 31.2 10.5 24Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M17.8 12.6C19.5 9.8 21.6 8.4 24 8.4C26.4 8.4 28.5 9.8 30.2 12.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M17.8 35.4C19.5 38.2 21.6 39.6 24 39.6C26.4 39.6 28.5 38.2 30.2 35.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
      <ellipse cx="24" cy="24" rx="6.6" ry="8.8" fill="currentColor" opacity="0.14" />
      <path d="M24 17.6V30.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="14.3" cy="12.4" r="1.5" fill="currentColor" opacity="0.45" />
      <circle cx="33.7" cy="12.4" r="1.5" fill="currentColor" opacity="0.45" />
      <circle cx="10.7" cy="34.2" r="1.7" fill="currentColor" opacity="0.35" />
      <circle cx="37.3" cy="34.2" r="1.7" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

ZavorthGatewayLogo.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};
