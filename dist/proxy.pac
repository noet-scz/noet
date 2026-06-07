function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.nt")) return "PROXY 144.31.25.136:8090";
  if (shExpMatch(host, "*.me")) return "PROXY 144.31.25.136:8090";
  return "DIRECT";
}
