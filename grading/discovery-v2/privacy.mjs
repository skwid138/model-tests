const PATTERNS = [
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['bearer_credential', /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i],
  ['credential_assignment', /\b(?:api[_-]?key|access[_-]?token|password|passwd|secret)\s*[:=]\s*["']?[^\s,"']+/i],
  ['credential_uri_userinfo', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i],
  ['http_endpoint', /\bhttps?:\/\/[^\s<>]+/i],
  ['machine_local_path', /(?:^|[^A-Za-z0-9])(?:\/(?:Users|home|private\/var|tmp)\/[^\s/]+|[A-Za-z]:\\(?:Users|Temp)\\[^\s\\]+|~\/[^\s]+)/],
  ['session_identifier', /\bses_?[a-z0-9]{12,}\b/i],
];

export function scanPrivacyPatterns(value) {
  const findings = [];
  const seen = new Set();
  const addFinding = (path, patternId) => {
    const key = `${path}\0${patternId}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ path, patternId });
  };
  const visit = (item, path) => {
    if (typeof item === 'string') {
      for (const [patternId, pattern] of PATTERNS) {
        if (pattern.test(item)) addFinding(path, patternId);
      }
    } else if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
    } else if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        const childPath = path ? `${path}.${key}` : key;
        const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
        if (/(?:^|_)(?:api_?key|access_?token|refresh_?token|auth_?token|password|passwd|secret|authorization|client_?secret|private_?key|bearer_?token|token)(?:_|$)/.test(normalizedKey)) {
          addFinding(childPath, 'credential_field_name');
        }
        visit(child, childPath);
      }
    }
  };
  visit(value, '');
  return findings;
}
