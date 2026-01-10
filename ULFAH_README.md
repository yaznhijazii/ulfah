# أُلْفَة - Ulfah
## تطبيق الأزواج الرومانسي

---

## 🚀 ال---

## 🚀 التسجسجيلل والدوالدخول

### ✅ول

### ✅ االمصمصادقة
-دقة
- **اس**اسم المسالمستخدخدم** + **كل** + **كلمةة المروالمرور**** (بد(بدون Google أو أ Google أو أي خدخدمة خة خارجية)
-جية)
- التسجيل يتطلب:لتسجيل يتطلب: الاسالاسم، اس، اسم االمستخدم،، كلمةمة اللمرور
-رور
- الالدخخولل يتطلب: اسيتطلب: اسم  المستخدم،لمستخدم، ككلمةمة الممرور فقور فقط

---

## 🔗🔗 ربطربط الششريكك

### منمن الإعدإعدادات:
1.ات:
1. المستخدممستخدم ييسجل/ل/يدخدخل → ي→ يدخل التطبطبيقق مباشرة
2.ة
2. يذهبيذهب لللإعدادات ⚙️ ⚙️
3.3. يضغطيضغط "ابدأ"ابدأ ربط الشريربط الشريك"
4."
4. يحصل على كود من ****6 أرقام****
5.5. ينسخينسخ الكودالكود وويرسله لرسله لشرييكه
6.ه
6. يدخيدخل  كود الالشريك
7.7. **يتم**يتم الربط للأبللأبد!**!** 🔒💝

---

##🔒💝

---

## 📱📱 االميزميزاتت

### الشاشة الرئيسية::
- عداد أيام العلاقة (يبدأ من 0) (يبدأ من 0)
- سؤالسؤال المزاج: "كيف شعور قلبك اليوم؟"
- 4 خيا4 خيارات:ات: سعيد، جعيد، جيد،د، عادي،، حزحزينن
- بطبطاقات سريعة للذكريات،، الألعاب، الوعود، الوعود

### الذكريات::
- إضافةإضافة ذكريات معع صور
- عرضرض خطخط زمنيزمني

### التقويم::
- إضإضافةفة أحداث بأبألواان مختلف مختلفة
- صور مصغرة للأحداث

### السفر::
- وجهات: مسافر، مخطط، حلم
- تقييم وملاحظات

### الألعاب::
- أسئلة يومية
- أسئلة "اعرفني"

### الوعود والقواعد::
- قائمة بالوعود
- قواعد العلاقة

---

---

## 🗄🗄️ ققاعدة ة البيانلبيانات

###
### جدوجدول المستخخدممين:
```sql
CREATEن:
```sql
CREATE TABLETABLE usersusers ((
  id UUID  id UUID PRIMARYPRIMARY KEY,KEY,
  namename TEXTTEXT NOT NULL,NOT NULL,
  username TEXT UNIQUE NOT NULL,  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  password_hash TEXT NOT NULL,
  avatar_url TEXT,  avatar_url TEXT,
  linking_codelinking_code TEXTTEXT UNIQUE,
UNIQUE,
  created_at TIME created_at TIMESTAMP,
  TAMP,
  upddated_ted_at TIMESTAMP
);
```t TIMESTAMP
);
```

### الجداول الأخأخرىى:
- ``partnerships`` - الشرشراككات
-- ``daily_moods`` - المشاعر اليومية
-- ``memories`` + ``memory_images`` - الذكريات
-- ``calendar_events`` - التقويم
-- ``travel_destinations`` - السفر
-- ``game_questions`` + ``game_answers`` - الألعاب
-- ``promises`` - الوعود
-- ``rules`` - القواعد
-- ``notification_settings`` - الإشعارات

---

## 🎨 التصميم

-🎨 التصميم

- **خ**خط:** Noto Kufi Arabic
- **ألوان:** باستيل (بيج، و:** Noto Kufi Arabic
- **ألوان:** باستيل (بيج، وردي، أبيض)
- **أدي، أبيض)
- **أيقونات:** Lucideونات:** Lucide React (بدون إيموجي)
- **React (بدون إيموجي)
- **اللوغو:** قلب بلوغو:** قلب بسيط دايط داخل ل دائرة وردية 💗ئرة وردية 💗

---

---

## ⚙️⚙️ الالإعداد

### ### 1. تتشغغيل SQLل SQL في Supabase:
```ba
```bash
# افتح Sh
# افتح Supabase Dashb Dashboardard →→ SQL Editor
## اانسخ محتوىى supabase_schema.sql
## اضغطضغط Run
```Run
```

### 2. إضإضافةفة المفاتاتيحح:
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

### 3. التشغيل:شغيل:
```bash
npm install
npm run dev
```

---

## ✅✅ النقاط النقاط المههمةة

-- ✅✅ **للا Google Sign-In Google Sign-In** -- فقطقط username +username + passwordpassword
- ✅ ✅ **Schema جديSchema جديد** -- usernameusername بدبدل emailemail
- ✅ ✅ **لالا بياناتبيانات وهميةوهمية** - التالتطبيقق ففارغغ تمتمامماًً
- ✅ ✅ **لوغولوغو بسيطبسيط** - قلبلب فقط
- ✅فقط
- ✅ **الر**الربطط من الإعدادعدادات** - ت** - لييس  بعدعد اللتسجيلسجيل مباشباشرة
- ✅✅ **TODO**TODO comments**comments** - في كفي كل مكمكانن يحيحتاجج SuSupaabasease

---

## 📝 TODO -📝 TODO - ربطبط SupabaseSupabase

### AuthLogin.tsxAuthLogin.tsx:
```typescript```typescript
//// TODO:TODO: ImplementImplement SupabaseSupabase authenticationauthentication
//// 1. QueryQuery usersusers tabletable withwith usernameusername
//// 22. VerifyVerify passwordpassword hashhash
//// 33. ReturnReturn useruser IDID
``````

#### AuthSignup.tsx:AuthSignup.tsx:
```typescript```typescript
//// TODO:TODO: ImplImplemmentnt Supabase signup
// 1. Chupabase signup
// 1. Check if k if usesername exname exissts
//s
// 2.2. HashHash passwordpassword
//// 3.3. InsertInsert newnew useruser
//// 4.4. ReturnReturn useruser IDID
``````

#### SSettingsSttingsScreen.reen.tsx:sx:
```t```typesscript
//
// TODO:TODO: GeneratGenerate code and code and save to usve to users rs tableable
//// TODO: FODO: Find user nd user with partth partnerCoerCode
// TODO:e
// TODO: Createreate partnershippartnership record
```
record
```

###### HomeSHomeScrereen.tsx:
```typn.tsx:
```typesscripript
//
// TODO:TODO: Save mood toSave mood to Supabase
// TODO:
// TODO: CalculateCalculate daysdays fromfrom partnership date
```partnership date
```

---

## 🔒🔒 الأأمانان

- كلماتكلمات المرومرور تُخزّنتُخزّن ****مُشفّرة**ُشفّرة** ((password_hssword_hash)h)
- استخدم bcryptاستخدم bcrypt أوأو مكتبكتبة مشمشابهبهة
- RLSRLS (Row(Row LevelLevel SecSecurity)rity) علىى ججميعع الجدجداول

---

صُنع بحب 💝 💝
أُلْفَة v1.0.0
