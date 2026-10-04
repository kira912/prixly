export default defineEventHandler(() => ({
  assistant: useLlm().enabled,
  ebay: ebayCredentials() !== null,
}))
