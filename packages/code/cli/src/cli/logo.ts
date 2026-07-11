export const logo = {
  left: [
    "                             Agent",
    "                                  ",
    "▀▀▀▀█ █▀▀█ █  █ █▀▀█ █▀▀█ ▀██▀ █  █",
    " ▄█▀  █▄▄█ █  █ █  █ █▄▄▀  ██  ████",
    "▀▀▀▀▀ ▀  ▀  ▀▀  ▀▀▀▀ ▀  ▀  ▀▀  ▀  ▀",
  ],
  right: [
    "",
    "",
    "",
    "",
    "",
  ],
}

export const logoThin = logo

export const logos = {
  thin: logo,
  classic: logo,
} as const

export type LogoKey = keyof typeof logos

export const go = {
  left: ["    ", "█▀▀█", "█  █", "▀▀▀▀"],
  right: ["    ", "█▀▀▀", "█ __", "▀▀▀▀"],
}

export const marks = "_^~,"
