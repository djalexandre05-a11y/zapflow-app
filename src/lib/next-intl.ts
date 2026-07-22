export function useTranslations(namespace?: string) {
  const t = (key: string, values?: Record<string, any>) => {
    const parts = key.split('.');
    let text = parts[parts.length - 1];
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        text = text.replace('{'+k+'}', String(v));
      }
    }
    return text;
  };
  t.rich = (key: string, values?: Record<string, any>) => {
    return t(key, values); // Ignorando formatações ricas por enquanto
  };
  return t;
}
