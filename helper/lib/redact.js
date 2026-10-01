export function redact(value) {
  return String(value).replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-[redacted]');
}
