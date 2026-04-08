import jsPDF from "jspdf";

interface WmCheck {
  number: string;
  name: string;
  section: string;
  status: string;
  errorCount?: number;
  errorUrls?: string[];
}

interface PdfMeta {
  domain: string;
  date: string;
  period: string;
  specialist: string;
}

const SECTION_LABELS: Record<string, { label: string; color: [number, number, number] }> = {
  fatal: { label: "Фатальные ошибки", color: [244, 67, 54] },
  critical: { label: "Критичные ошибки", color: [255, 152, 0] },
  possible: { label: "Возможные проблемы", color: [255, 193, 7] },
  recommendation: { label: "Рекомендации", color: [33, 150, 243] },
};

const IMPORTANCE_MAP: Record<string, string> = {
  "1.1": "высокая", "1.2": "средняя", "1.3": "высокая", "1.4": "высокая", "1.5": "высокая",
  "2.1": "средняя", "2.2": "средняя", "2.3": "высокая", "2.4": "высокая", "2.5": "средняя",
  "3.1": "средняя", "3.2": "средняя", "3.3": "средняя", "3.4": "средняя", "3.5": "низкая",
  "3.6": "средняя", "3.7": "средняя", "3.8": "средняя", "3.9": "средняя", "3.10": "низкая",
  "3.11": "средняя", "3.12": "низкая", "3.13": "средняя", "3.14": "низкая", "3.15": "средняя",
  "3.16": "высокая", "3.17": "низкая", "3.18": "низкая", "3.19": "средняя", "3.20": "низкая",
  "4.1": "низкая", "4.2": "низкая", "4.3": "низкая", "4.4": "низкая", "4.5": "средняя",
  "4.6": "средняя", "4.7": "низкая",
};

const DIFFICULTY_MAP: Record<string, string> = {
  "1.1": "средняя", "1.2": "низкая", "1.3": "высокая", "1.4": "средняя", "1.5": "низкая",
  "2.1": "высокая", "2.2": "средняя", "2.3": "высокая", "2.4": "средняя", "2.5": "средняя",
  "3.1": "средняя", "3.2": "средняя", "3.3": "низкая", "3.4": "низкая", "3.5": "низкая",
  "3.6": "средняя", "3.7": "низкая", "3.8": "низкая", "3.9": "средняя", "3.10": "низкая",
  "3.11": "средняя", "3.12": "низкая", "3.13": "средняя", "3.14": "низкая", "3.15": "средняя",
  "3.16": "средняя", "3.17": "низкая", "3.18": "низкая", "3.19": "средняя", "3.20": "низкая",
  "4.1": "низкая", "4.2": "низкая", "4.3": "низкая", "4.4": "низкая", "4.5": "низкая",
  "4.6": "средняя", "4.7": "низкая",
};

const DESC_MAP: Record<string, string> = {
  "1.1": "Проверка наличия вредоносного кода, фишинговых страниц и других угроз безопасности на сайте.",
  "1.2": "Проверка корректности DNS-записей домена. Ошибки DNS приводят к полной недоступности сайта.",
  "1.3": "Проверка доступности сервера. Ошибки сервера делают сайт полностью недоступным для поисковых роботов.",
  "1.4": "Проверка доступности главной страницы сайта для поискового робота Яндекса.",
  "1.5": "Проверка, не закрыт ли сайт целиком от индексации в файле robots.txt.",
  "2.1": "Проверка корректности SSL-сертификата. Ошибки SSL снижают доверие пользователей и поисковых систем.",
  "2.2": "Поиск дублирующихся страниц, созданных из-за GET-параметров в URL.",
  "2.3": "Обнаружение страниц, отвечающих кодом 5xx (серверные ошибки).",
  "2.4": "Обнаружение страниц, отвечающих кодом 4xx (страница не найдена и др.).",
  "2.5": "Проверка скорости ответа сервера. Медленный ответ ухудшает индексацию.",
  "3.1": "Проверка корректности обработки несуществующих URL (должен возвращаться код 404).",
  "3.2": "Поиск страниц без заполненного тега title.",
  "3.3": "Проверка файла robots.txt на наличие синтаксических ошибок.",
  "3.4": "Проверка привязки счётчика Яндекс.Метрики к сайту в Вебмастере.",
  "3.5": "Обнаружение поддоменов сайта, отображающихся в поисковой выдаче.",
  "3.6": "Поиск страниц с одинаковыми заголовками title и описаниями description.",
  "3.7": "Проверка наличия файла robots.txt на сайте.",
  "3.8": "Проверка наличия XML-карты сайта (Sitemap).",
  "3.9": "Поиск полных дублей страниц на сайте.",
  "3.10": "Проверка доступности файла favicon для поискового робота.",
  "3.11": "Поиск страниц без заполненного метатега description.",
  "3.12": "Проверка пользовательского соглашения для видеоконтента.",
  "3.13": "Проверка, не перенаправляет ли главная страница на другой домен.",
  "3.14": "Проверка включения обхода сайта по данным счётчика Метрики.",
  "3.15": "Проверка файлов Sitemap на наличие ошибок.",
  "3.16": "Обнаружение полезных страниц, закрытых от индексации.",
  "3.17": "Проверка необходимости принять соглашение с Яндексом.",
  "3.18": "Проверка актуальности файлов Sitemap.",
  "3.19": "Проверка, что главное зеркало сайта работает по протоколу HTTPS.",
  "3.20": "Проверка передачи всех товаров в поисковую выдачу Яндекса.",
  "4.1": "Рекомендуется добавить SVG-иконку favicon размером 120×120 пикселей.",
  "4.2": "Рекомендуется указать регион сайта в настройках Яндекс Вебмастера.",
  "4.3": "Информация о создании карточки организации в Яндекс Бизнесе.",
  "4.4": "Рекомендуется добавить сайт в Яндекс Бизнес для улучшения присутствия.",
  "4.5": "Рекомендуется установить счётчик Яндекс.Метрики на сайт.",
  "4.6": "Проверка оптимизации сайта для мобильных устройств.",
  "4.7": "Проверка наличия файла favicon на сайте.",
};

function addPageHeader(pdf: jsPDF, domain: string, pageNum: number) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(domain, 15, 10);
  pdf.text("Анализ Яндекс Вебмастер", pw - 15, 10, { align: "right" });
  pdf.text(String(pageNum), pw - 15, ph - 8, { align: "right" });
  // separator line
  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, 13, pw - 15, 13);
}

function ensureSpace(pdf: jsPDF, needed: number, y: number, domain: string, pageRef: { num: number }): number {
  const ph = pdf.internal.pageSize.getHeight();
  if (y + needed > ph - 20) {
    pdf.addPage();
    pageRef.num++;
    addPageHeader(pdf, domain, pageRef.num);
    return 22;
  }
  return y;
}

export function generateWebmasterPdf(checks: WmCheck[], meta: PdfMeta) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const pageRef = { num: 1 };

  // ========== COVER PAGE ==========
  // Wavy background pattern
  pdf.setFillColor(245, 245, 250);
  pdf.rect(0, 0, pw, ph, "F");
  pdf.setDrawColor(230, 230, 240);
  for (let i = 0; i < ph; i += 12) {
    pdf.setLineWidth(0.3);
    pdf.line(0, i, pw, i);
  }

  // Title block
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(30, 60, pw - 60, 120, 4, 4, "F");
  pdf.setDrawColor(100, 100, 200);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(30, 60, pw - 60, 120, 4, 4, "S");

  pdf.setFontSize(24);
  pdf.setTextColor(30, 30, 80);
  pdf.text("Анализ Яндекс Вебмастер", pw / 2, 85, { align: "center" });

  // Table with fields
  const tableX = 45;
  let tableY = 105;
  pdf.setFontSize(11);
  const fields = [
    ["Сайт:", meta.domain],
    ["Дата:", meta.date],
    ["Период:", meta.period],
    ["Подготовил:", meta.specialist],
  ];
  for (const [label, value] of fields) {
    pdf.setTextColor(120, 120, 140);
    pdf.text(label, tableX, tableY);
    pdf.setTextColor(30, 30, 60);
    pdf.text(value, tableX + 40, tableY);
    tableY += 10;
  }

  // Footer on cover
  pdf.setFontSize(8);
  pdf.setTextColor(170, 170, 190);
  pdf.text("StatPulse SEO Platform", pw / 2, ph - 15, { align: "center" });

  // ========== PAGE 2 — TABLE OF CONTENTS ==========
  pdf.addPage();
  pageRef.num++;
  addPageHeader(pdf, meta.domain, pageRef.num);

  pdf.setFontSize(18);
  pdf.setTextColor(30, 30, 60);
  pdf.text("Оглавление", 15, 30);

  const sections: { key: string; label: string }[] = [
    { key: "fatal", label: "1. Фатальные ошибки" },
    { key: "critical", label: "2. Критичные ошибки" },
    { key: "possible", label: "3. Возможные проблемы" },
    { key: "recommendation", label: "4. Рекомендации" },
    { key: "fixes", label: "5. Рекомендации по исправлениям" },
  ];

  let tocY = 45;
  pdf.setFontSize(11);
  for (const sec of sections) {
    pdf.setTextColor(50, 50, 70);
    pdf.text(sec.label, 20, tocY);
    // dot leaders
    const textWidth = pdf.getTextWidth(sec.label);
    const dotsStart = 20 + textWidth + 2;
    const dotsEnd = pw - 30;
    let dx = dotsStart;
    pdf.setTextColor(180, 180, 180);
    while (dx < dotsEnd) {
      pdf.text(".", dx, tocY);
      dx += 2;
    }
    tocY += 10;
  }

  // ========== SECTIONS ==========
  const sectionOrder: string[] = ["fatal", "critical", "possible", "recommendation"];

  for (const secKey of sectionOrder) {
    pdf.addPage();
    pageRef.num++;
    addPageHeader(pdf, meta.domain, pageRef.num);

    const secMeta = SECTION_LABELS[secKey];
    const secChecks = checks.filter(c => c.section === secKey);
    const secNum = sectionOrder.indexOf(secKey) + 1;

    // Section title
    pdf.setFontSize(16);
    pdf.setTextColor(secMeta.color[0], secMeta.color[1], secMeta.color[2]);
    pdf.text(`${secNum}. ${secMeta.label}`, 15, 28);

    pdf.setDrawColor(secMeta.color[0], secMeta.color[1], secMeta.color[2]);
    pdf.setLineWidth(0.8);
    pdf.line(15, 31, pw - 15, 31);

    let y = 40;

    for (const check of secChecks) {
      y = ensureSpace(pdf, 40, y, meta.domain, pageRef);

      // Check title
      pdf.setFontSize(12);
      pdf.setTextColor(30, 30, 60);
      pdf.text(`${check.number} ${check.name}`, 15, y);
      y += 6;

      // Importance & Difficulty
      const imp = IMPORTANCE_MAP[check.number] || "средняя";
      const diff = DIFFICULTY_MAP[check.number] || "средняя";
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 120);
      pdf.text(`Важность – ${imp}     Сложность внесения – ${diff}`, 15, y);
      y += 5;

      // Description
      const desc = DESC_MAP[check.number] || "";
      if (desc) {
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 100);
        const lines = pdf.splitTextToSize(desc, pw - 30);
        pdf.text(lines, 15, y);
        y += lines.length * 4.5;
      }
      y += 2;

      // Result
      pdf.setFontSize(10);
      if (check.status === "ok") {
        pdf.setTextColor(46, 125, 50); // #2E7D32
        pdf.text("Результат проверки: Ошибки не найдены", 15, y);
      } else if (check.status === "error") {
        pdf.setTextColor(198, 40, 40); // #C62828
        pdf.text("Результат проверки: Ошибка обнаружена", 15, y);
        y += 5;
        pdf.setFontSize(9);
        pdf.setTextColor(150, 80, 80);
        pdf.text("Задание по устранению ошибки описано в блоке рекомендаций", 15, y);

        // Error URLs if any
        if (check.errorUrls && check.errorUrls.length > 0) {
          y += 5;
          pdf.setFontSize(8);
          pdf.setTextColor(120, 120, 140);
          const showUrls = check.errorUrls.slice(0, 5);
          for (const url of showUrls) {
            y = ensureSpace(pdf, 5, y, meta.domain, pageRef);
            pdf.text(`  • ${url}`, 18, y);
            y += 4;
          }
          if (check.errorUrls.length > 5) {
            pdf.text(`  ... и ещё ${check.errorUrls.length - 5} страниц`, 18, y);
            y += 4;
          }
        }
      } else {
        pdf.setTextColor(150, 150, 150);
        pdf.text("Результат проверки: Не проверено", 15, y);
      }
      y += 6;

      // Dotted separator
      pdf.setDrawColor(210, 210, 220);
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(15, y, pw - 15, y);
      pdf.setLineDashPattern([], 0);
      y += 6;
    }
  }

  // ========== SECTION 5 — RECOMMENDATIONS ==========
  const errorChecks = checks.filter(c => c.status === "error");
  if (errorChecks.length > 0) {
    pdf.addPage();
    pageRef.num++;
    addPageHeader(pdf, meta.domain, pageRef.num);

    pdf.setFontSize(16);
    pdf.setTextColor(198, 40, 40);
    pdf.text("5. Рекомендации по исправлениям", 15, 28);
    pdf.setDrawColor(198, 40, 40);
    pdf.setLineWidth(0.8);
    pdf.line(15, 31, pw - 15, 31);

    let y = 40;
    errorChecks.forEach((check, idx) => {
      y = ensureSpace(pdf, 30, y, meta.domain, pageRef);

      const secMeta = SECTION_LABELS[check.section];

      // Number badge
      pdf.setFillColor(secMeta.color[0], secMeta.color[1], secMeta.color[2]);
      pdf.circle(20, y - 1, 3, "F");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(idx + 1), 20, y, { align: "center" });

      // Check name
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 60);
      pdf.text(`${check.number} ${check.name}`, 27, y);
      y += 5;

      // Priority
      const imp = IMPORTANCE_MAP[check.number] || "средняя";
      pdf.setFontSize(9);
      if (imp === "высокая") {
        pdf.setTextColor(198, 40, 40);
        pdf.text("Приоритет: Высокий", 27, y);
      } else if (imp === "средняя") {
        pdf.setTextColor(255, 152, 0);
        pdf.text("Приоритет: Средний", 27, y);
      } else {
        pdf.setTextColor(120, 120, 140);
        pdf.text("Приоритет: Низкий", 27, y);
      }
      y += 5;

      // Description
      const desc = DESC_MAP[check.number] || "";
      if (desc) {
        pdf.setFontSize(9);
        pdf.setTextColor(80, 80, 100);
        const lines = pdf.splitTextToSize(desc, pw - 42);
        pdf.text(lines, 27, y);
        y += lines.length * 4;
      }

      y += 4;
      pdf.setDrawColor(210, 210, 220);
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(15, y, pw - 15, y);
      pdf.setLineDashPattern([], 0);
      y += 6;
    });
  }

  // Save
  const safeDomain = meta.domain.replace(/[^a-zA-Zа-яА-ЯёЁ0-9.-]/g, "_");
  const safeDate = meta.date.replace(/[^0-9.]/g, "_");
  pdf.save(`${safeDomain}_Яндекс_Вебмастер_${safeDate}.pdf`);
}
