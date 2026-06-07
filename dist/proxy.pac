function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.nt")) return "PROXY 127.0.0.1:8090";
  if (shExpMatch(host, "*.me")) return "PROXY 127.0.0.1:8090";
  return "DIRECT";
}
