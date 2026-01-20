const hasAny = (paths: string[], needles: string[]) =>
  paths.some(path => needles.some(needle => path.toLowerCase().includes(needle)));

export const buildRunbookMarkdown = (filePaths: string[], configContents: Record<string, string>) => {
  const hasDocker = hasAny(filePaths, ['dockerfile', 'docker-compose']);
  const hasK8s = hasAny(filePaths, ['k8s', 'kubernetes', 'helm']);
  const hasTerraform = hasAny(filePaths, ['terraform', '.tf']);
  const hasEnv = Object.keys(configContents).some(name => name.startsWith('.env') || name === '.env');

  const incidentResponse = [
    '### 🛠 Runbook (Incident Response)',
    '- بررسی سلامت سرویس‌ها (health checks و لاگ‌ها).',
    '- شناسایی سرویس/ماژول معیوب و سطح تاثیر.',
    '- اجرای fallback یا محدودسازی دسترسی موقت.',
    '- ثبت Incident و ریشه‌یابی پس از رفع.'
  ].join('\n');

  const deployPlaybook = [
    '### 🚀 Playbook (Deploy / Rollback)',
    `- استقرار با Docker${hasDocker ? ' (Dockerfile شناسایی شد)' : ''}.`,
    `- استقرار با Kubernetes/Helm${hasK8s ? ' (Manifest شناسایی شد)' : ''}.`,
    `- Infra as Code با Terraform${hasTerraform ? ' (فایل‌های IaC شناسایی شد)' : ''}.`,
    '- مراحل Rollback: بازگشت به آخرین نسخه پایدار و پاکسازی کش.'
  ].join('\n');

  const monitoring = [
    '### 📈 Monitoring (SLO/SLA)',
    '- تعریف SLO برای latency و availability.',
    '- تعریف SLA برای پاسخ‌گویی.',
    `- مدیریت متغیرهای محیطی${hasEnv ? ' (.env شناسایی شد)' : ''}.`
  ].join('\n');

  return [
    '## 🧰 مستندات عملیاتی (Runbook / SRE)',
    incidentResponse,
    '',
    deployPlaybook,
    '',
    monitoring
  ].join('\n');
};
