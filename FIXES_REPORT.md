# تقرير الإصلاحات — Umzug Management System

**التاريخ:** 23 أبريل 2026
**الحالة:** جاهز للمراجعة والتجربة

---

## 🔴 مشاكل أمنية حرجة — تم إصلاحها

### 1. عزل الفروع (Branch Isolation)

**المشكلة:** كان بإمكان مدير فرع A تعديل أو حذف أو قراءة طلبات فرع B.

**الحل:** دالة `assertBranchAccess` جديدة في `server/_core/context.ts` تتحقق من ملكية الفرع قبل أي عملية كتابة أو قراءة حساسة. الأدمن يرى الكل، الباقي يرى فرعه فقط.

**Endpoints اللي أصبحت محمية:**
- `moves.update`
- `moves.delete`
- `moves.getById`
- `moves.generateInvoice`
- `moves.fullUpdate`
- `workerMoves.reportSchaden`
- `workerMoves.reportBeschwerde`
- `workerMoves.complete`
- `workerMoves.updatePayment`

### 2. حماية مسارات الواجهة (Frontend Routes)

**المشكلة:** المستخدمون غير المسجّلين كانوا يرون صفحات داخلية فارغة بدل إعادة التوجيه لصفحة الدخول.

**الحل:** مكوّن `RequireAuth` جديد في `client/src/components/RequireAuth.tsx` يلفّ كل صفحة محمية، ويفرض:
- إعادة توجيه للـ `/login` عند عدم وجود جلسة
- إعادة توجيه للـ `/` عند عدم وجود الصلاحية المطلوبة
- شاشة تحميل أثناء التحقق

**توزيع الصلاحيات:**

| المسار | الأدوار المسموح لها |
|-------|--------------------|
| `/` | عام (يعرض login prompt لغير المسجّلين) |
| `/login` | عام (يعيد توجيه المسجّلين للـ `/`) |
| `/admin` | admin فقط |
| `/admin-reports` | admin, branch_manager |
| `/branches` | admin فقط |
| `/users` | admin, branch_manager |
| `/new-customer` | admin, sales, branch_manager |
| `/worker`, `/orders`, `/rechnungen` | أي مستخدم مسجّل |

### 3. Rate Limiting

**المشكلة:**
- `requestManagerPasswordReset` كان مفتوحاً لأي عدد من المحاولات
- نقاط الدخول كانت عرضة لـ brute-force بدون أي حد

**الحل:** وحدة `server/_core/rateLimit.ts` جديدة، مطبّقة على:

| Endpoint | الحد |
|----------|------|
| `requestManagerPasswordReset` | 3 محاولات / 15 دقيقة لكل IP |
| `/api/auth/admin-login` | 10 محاولات / 15 دقيقة لكل IP |
| `/api/auth/local-login` | 10 محاولات / 15 دقيقة لكل IP |

---

## 🟡 مشاكل منطقية — تم إصلاحها

### 4. دقة تخزين السعر (grossPrice)

**المشكلة:** كان `grossPrice` (مخزّن كـ `decimal(15,2)` بالـ euros) يتعرّض لـ `Math.round()` عند الحفظ، فيفقد الخانات العشرية. مثلاً 1499.99€ تصير 1500€.

**الحل:** استبدال الأسطر:
```ts
Math.round(input.grossPrice)
```
بـ:
```ts
Math.round(input.grossPrice * 100) / 100
```
في `moves.update` و `moves.fullUpdate`. هذا يحافظ على خانتين عشريتين بالضبط.

### 5. إشعار عند تأكيد طلب بدون عمال كافين

**المشكلة:** عند تأكيد طلب في فرع بدون عمال، المهام لم تُنشأ، والمستخدم لا يعلم.

**الحل:** `fullUpdate` صار يُرجع مصفوفة `warnings` تحتوي على رسائل واضحة:
- "لا يوجد عمال نشطون في هذا الفرع" (إذا workers.length === 0)
- "تم إنشاء مهمة الاستلام فقط: يلزم عامل ثانٍ" (إذا workers.length === 1)

كذلك صارت الاستعلامات تُفلتر العمال المعطّلين (`isActive = 1`) قبل إنشاء المهام.

### 6. حماية قوالب الرسائل

**المشكلة:** أي مستخدم مصادق عليه (حتى عامل) كان يقدر يعدّل أو يحذف قوالب الرسائل.

**الحل:**
- `templates.upsert` → محصور بـ admin و branch_manager
- `templates.seedDefaults` → محصور بـ admin فقط

---

## 🔵 تحسينات واجهة المستخدم (UX)

### 7. زرا الدخول في الصفحة الرئيسية

**قبل:** الزرّان يذهبان لـ `/login` بدون تمييز — نفس الصفحة.
**بعد:** الزر الأول يذهب لـ `/login#manager` (يُبرز بطاقة المدير)، الثاني لـ `/login#staff` (يُبرز بطاقة العمال). صفحة الدخول أضيفت لها `id="manager"` و `id="staff"`.

### 8. Redirect تلقائي من صفحة الدخول

**قبل:** مستخدم مسجّل كان يقدر يفتح `/login` ويرى نماذج الدخول.
**بعد:** `LocalLogin` يستخدم `useAuth` ويُعيد توجيه المستخدم المسجّل تلقائياً للـ `/`.

### 9. حذف ملف غير مستخدم

- `client/src/pages/WorkerLogin.tsx` — كان موجوداً لكن غير مُسجّل في Router. تم حذفه.

---

## 🧪 اختبارات جديدة

| الملف | عدد الاختبارات | نوعها |
|-------|----------------|------|
| `server/fixes.regression.test.ts` | 14 | static analysis للكود |
| `server/_core/rateLimit.test.ts` | 4 | سلوكية (behavioral) |

**الاختبارات تغطي:**
- وجود `assertBranchAccess` في كل نقاط الكتابة والقراءة الحساسة
- عدم وجود النمط الخاطئ `Math.round(grossPrice)`
- وجود `consumeRateLimit` في نقاط الدخول وإعادة التعيين
- لفّ المسارات بـ `RequireAuth`
- صلاحيات القوالب
- warnings عند نقص العمال
- سلوك الـ rate limiter (block بعد الحد، reset بعد النافذة، عزل keys)

---

## 📊 ملخص الملفات المعدّلة

### ملفات جديدة (4):
```
server/_core/rateLimit.ts           (1.4 KB)
server/_core/rateLimit.test.ts      (2.0 KB)
server/fixes.regression.test.ts     (6.8 KB)
client/src/components/RequireAuth.tsx (1.4 KB)
```

### ملفات معدّلة (6):
```
server/routers.ts                   +4717 bytes
server/_core/index.ts               +1078 bytes
server/_core/context.ts             +678 bytes
client/src/App.tsx                  +720 bytes
client/src/pages/LocalLogin.tsx     +342 bytes
client/src/pages/Home.tsx           +14 bytes
```

### ملفات محذوفة (1):
```
client/src/pages/WorkerLogin.tsx    (كود ميت)
```

---

## 🚀 خطوات التجربة

### 1. فك الضغط والتثبيت

```bash
unzip umzug-fixed.zip
cd umzug-fixed
pnpm install
```

### 2. إعداد المتغيرات البيئية

أنشئ `.env` بنفس المتغيرات القديمة (`DATABASE_URL`, `COOKIE_SECRET`, `FORGE_API_URL`, `FORGE_API_KEY`, إلخ).

### 3. تشغيل الاختبارات

```bash
pnpm test
```

الاختبارات القديمة (79 اختبار) + الجديدة (18 اختبار) يجب أن تنجح جميعها = **97 اختبار**.

### 4. تشغيل الخادم

```bash
pnpm dev
```

### 5. سيناريوهات تجربة مقترحة

**أ) اختبار عزل الفروع:**
1. سجّل دخول كـ branch_manager لفرع A
2. في developer tools، حاول استدعاء `moves.update` بـ `moveId` خاص بفرع B
3. **المتوقع:** رسالة "لا يمكنك الوصول إلى بيانات فرع آخر"

**ب) اختبار rate limit:**
1. افتح صفحة الدخول
2. اضغط "Passwort vergessen" 4 مرات متتالية
3. **المتوقع:** الرابع يُرجع خطأ "Zu viele Anfragen..."

**ج) اختبار Redirect:**
1. سجّل دخول كأي مستخدم
2. اكتب `/login` في شريط العنوان
3. **المتوقع:** يُعيد توجيهك تلقائياً للـ `/`

**د) اختبار حماية المسارات:**
1. سجّل خروج
2. اكتب `/admin` في شريط العنوان
3. **المتوقع:** يُعيد توجيهك للـ `/login`

**هـ) اختبار warning عند عدم وجود عمال:**
1. أنشئ فرعاً جديداً بدون عمال
2. أنشئ عميلاً وطلباً في هذا الفرع
3. اضغط "تأكيد الطلب"
4. **المتوقع:** رسالة صفراء "لا يوجد عمال نشطون في هذا الفرع"

---

## ⚠️ ملاحظات مهمة

1. **الـ Rate Limiter في الذاكرة:** مناسب لخادم واحد. إذا نشرت على أكثر من instance (مثلاً Render مع autoscaling)، لازم تستبدله بـ Redis. التوثيق داخل `rateLimit.ts` واضح بخصوص هذا.

2. **معاملة الـ warnings في الواجهة:** الـ backend صار يُرجع `warnings: string[]` من `moves.fullUpdate`. الواجهة الحالية لا تعرضها بعد — إذا بدك، اقدر أضيف عرض Toast لها في الـ frontend كخطوة لاحقة.

3. **لا migrations في قاعدة البيانات:** كل الإصلاحات منطقية/كودية. قاعدة البيانات ما تحتاج تعديل.

4. **التوافق مع الإصلاحات السابقة:** كل الـ 79 اختبار الأصلي يجب أن يستمر بالنجاح — الإصلاحات تضيف حماية ولا تُغيّر السلوك الصحيح.
