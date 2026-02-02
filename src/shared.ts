// Approval string to be shared across frontend and backend
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied."
} as const;

// Runtime API configuration (set by server, used by tools)
export const apiConfig = {
  alpacaApiKey: "",
  alpacaSecretKey: ""
};

export function setApiConfig(config: { alpacaApiKey: string; alpacaSecretKey: string }) {
  apiConfig.alpacaApiKey = config.alpacaApiKey;
  apiConfig.alpacaSecretKey = config.alpacaSecretKey;
}
