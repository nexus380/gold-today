// netlify/functions/generate-post.js
// This function is triggered by Netlify CMS after publishing a post
// It reads the frontmatter + markdown and writes a proper HTML file

const { marked } = require('marked');

function arabicDate(isoDate) {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const d = new Date(isoDate);
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function buildHTML({ title, description, category, readtime, date, image, body, slug }) {
  const dateISO = date || new Date().toISOString();
  const dateAr  = arabicDate(dateISO);
  const imgTag  = image
    ? `<img src="${image}" alt="${title}" class="article-hero-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="article-hero-placeholder" style="display:none">🥇</div>`
    : `<div class="article-hero-placeholder">🥇</div>`;

  const bodyHTML = marked.parse(body || '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N5PXZ76R');<\/script>
<!-- End Google Tag Manager -->
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | الذهب اليوم</title>
  <meta name="description" content="${description}" />
  <meta property="og:title"       content="${title} | الذهب اليوم" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type"        content="article" />
  <meta property="og:url"         content="https://alzahabalyoum.com/blog/posts/${slug}.html" />
  <meta property="og:image"       content="${image || 'https://alzahabalyoum.com/og-image.png'}" />
  <meta property="article:published_time" content="${dateISO}" />
  <meta property="article:modified_time"  content="${dateISO}" />
  <meta property="article:author"         content="فريق الذهب اليوم" />
  <link rel="canonical" href="https://alzahabalyoum.com/blog/posts/${slug}.html" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/shared.css" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "description": "${description}",
    "image": "${image || 'https://alzahabalyoum.com/og-image.png'}",
    "datePublished": "${dateISO}",
    "dateModified":  "${dateISO}",
    "author": { "@type": "Organization", "name": "الذهب اليوم", "url": "https://alzahabalyoum.com" },
    "publisher": {
      "@type": "Organization", "name": "الذهب اليوم", "url": "https://alzahabalyoum.com",
      "logo": { "@type": "ImageObject", "url": "https://alzahabalyoum.com/apple-touch-icon.png" }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://alzahabalyoum.com/blog/posts/${slug}.html" }
  }
  <\/script>
  <style>
    .article-header{margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid var(--border)}
    .article-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:.78rem;color:var(--text-dim);margin-bottom:16px;align-items:center}
    .article-cat{background:rgba(212,175,55,.1);border:1px solid var(--border);color:var(--gold);font-size:.72rem;font-weight:700;padding:3px 12px;border-radius:50px}
    .article-title{font-family:'Tajawal',sans-serif;font-weight:900;font-size:clamp(1.6rem,3.5vw,2.4rem);line-height:1.3;margin-bottom:12px;color:var(--text-main)}
    .article-lead{font-size:1.05rem;color:var(--text-muted);line-height:1.9}
    .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--gold);font-size:.84rem;text-decoration:none;margin-bottom:32px}
    .back-link:hover{text-decoration:underline}
    .article-hero-img{width:100%;height:200px;object-fit:cover;border-radius:12px;margin-bottom:28px;display:block;border:1px solid var(--border)}
    @media(min-width:640px){.article-hero-img{height:280px}}
    .article-hero-placeholder{width:100%;height:180px;border-radius:12px;background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(139,105,20,.06));border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:4rem;margin-bottom:28px}
    .prose h2{font-family:'Tajawal',sans-serif;font-weight:900;font-size:1.35rem;margin:32px 0 14px;color:var(--text-main)}
    .prose h3{font-family:'Tajawal',sans-serif;font-weight:800;font-size:1.1rem;margin:24px 0 10px;color:var(--gold)}
    .prose p{color:var(--text-muted);line-height:1.95;margin-bottom:16px;font-size:.97rem}
    .prose a{color:var(--gold)}
    .prose strong{color:var(--text-main)}
    .prose ul,.prose ol{margin:14px 0 18px 24px;color:var(--text-muted);line-height:2;font-size:.97rem}
    .price-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:.9rem}
    .price-table th{background:rgba(212,175,55,.1);color:var(--gold);font-weight:700;padding:10px 14px;text-align:right;border:1px solid var(--border)}
    .price-table td{padding:10px 14px;border:1px solid var(--border);color:var(--text-muted)}
    .price-table tr:nth-child(even) td{background:rgba(255,255,255,.02)}
    .cta-box{background:linear-gradient(135deg,rgba(212,175,55,.1),rgba(139,105,20,.08));border:1px solid rgba(212,175,55,.3);border-radius:16px;padding:28px;text-align:center;margin:36px 0}
    .cta-box h3{font-family:'Tajawal',sans-serif;font-weight:900;font-size:1.2rem;margin-bottom:10px;color:var(--text-main)}
    .cta-box p{font-size:.88rem;color:var(--text-muted);margin-bottom:18px}
    .cta-btn{display:inline-block;padding:11px 28px;background:linear-gradient(135deg,#D4AF37,#B8960C);border-radius:10px;color:#000;font-weight:800;font-size:.9rem;text-decoration:none}
    .related-section{margin-top:60px;padding-top:36px;border-top:1px solid var(--border)}
    .related-section h3{font-family:'Tajawal',sans-serif;font-weight:800;font-size:1.2rem;margin-bottom:20px}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
    .related-card{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:12px;padding:16px;text-decoration:none;display:block;transition:border-color .2s}
    .related-card:hover{border-color:rgba(212,175,55,.4)}
    .related-card .emoji{font-size:1.5rem;margin-bottom:8px;display:block}
    .related-card .title{font-size:.85rem;font-weight:600;color:var(--text-main);line-height:1.4}
  </style>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3DMN5NNKYN"><\/script>
  <script>
    window.dataLayer=window.dataLayer||[];
    function gtag(){dataLayer.push(arguments);}
    gtag('js',new Date());
    gtag('config','G-3DMN5NNKYN',{anonymize_ip:true});
  <\/script>
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"><\/script>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-N5PXZ76R"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<div class="bg-orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div></div>
<nav>
  <a href="/" class="nav-logo">
    <img src="/images/logo.png" alt="الذهب اليوم" class="nav-logo-img" onerror="this.style.display='none'" />
    <span class="nav-logo-text">الذهب اليوم</span>
  </a>
  <ul class="nav-links">
    <li><a href="/">الأسعار المباشرة</a></li>
    <li><a href="/blog/" class="active">أخبار الذهب</a></li>
    <li><a href="/pages/about.html">من نحن</a></li>
    <li><a href="/pages/contact.html">اتصل بنا</a></li>
  </ul>
</nav>
<div class="content-wrap">
<div class="page-wrap">
  <a href="/blog/" class="back-link">← العودة إلى أخبار الذهب</a>
  ${imgTag}
  <div class="article-header">
    <div class="article-meta">
      <span class="article-cat">${category}</span>
      <span>✍️ فريق التحرير</span>
      <time datetime="${dateISO}">📅 ${dateAr}</time>
      <span>⏱ ${readtime}</span>
    </div>
    <h1 class="article-title">${title}</h1>
    <p class="article-lead">${description}</p>
  </div>
  <div class="prose">
    ${bodyHTML}
    <div class="cta-box">
      <h3>🥇 تابع أسعار الذهب لحظة بلحظة</h3>
      <p>أسعار محدثة كل 60 ثانية من المصادر العالمية</p>
      <a href="/" class="cta-btn">عرض الأسعار المباشرة</a>
    </div>
  </div>
  <div class="related-section">
    <h3>📰 مقالات ذات صلة</h3>
    <div class="related-grid">
      <a href="/blog/posts/gold-price-egypt.html" class="related-card"><span class="emoji">🇪🇬</span><span class="title">سعر الذهب اليوم في مصر</span></a>
      <a href="/blog/posts/will-gold-rise.html" class="related-card"><span class="emoji">📈</span><span class="title">هل الذهب هيغلى؟</span></a>
      <a href="/blog/posts/karat-21-vs-24.html" class="related-card"><span class="emoji">💎</span><span class="title">الفرق بين عيار 21 و24</span></a>
    </div>
  </div>
</div>
</div>
<footer>
  <div style="max-width:860px;margin:0 auto;text-align:center;padding:36px 20px">
    <a href="/" style="font-family:'Tajawal',sans-serif;font-weight:900;font-size:1.1rem;background:linear-gradient(90deg,#F0D060,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-decoration:none">🥇 الذهب اليوم</a>
    <p style="font-size:.75rem;color:#444;margin-top:14px">© 2026 الذهب اليوم — جميع الحقوق محفوظة</p>
  </div>
</footer>
</body>
</html>`;
}

exports.handler = async function(event) {
  return { statusCode: 200, body: 'OK' };
};
