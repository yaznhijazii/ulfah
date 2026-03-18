export interface PartnerStatus {
    mood: string | null;
    lastNote?: string | null;
}

export const getAIRecommendation = (status: PartnerStatus): { title: string; advice: string } => {
    const { mood, lastNote } = status;

    if (mood === 'sad') {
        return {
            title: 'لمسة مواساة 🕊️',
            advice: 'يبدو أن شريكك يمر بوقت عصيب. جرب إرسال رسالة صوتية دافئة أو عرض عليه جلسة استماع دون مقاطعة.'
        };
    }

    if (mood === 'tired') {
        return {
            title: 'ملاذ الراحة ☕',
            advice: 'شريكك يشعر بالإرهاق. ما رأيك بتجهيز مشروبه المفضل أو القيام بعمل صغير من مهامه ليتمكن من الراحة؟'
        };
    }

    if (mood === 'happy') {
        return {
            title: 'مضاعفة الفرح 🌟',
            advice: 'مزاج شريكك رائع! استغل اللحظة لمشاركته ذكرى سعيدة أو التخطيط لمغامرة بسيطة في نهاية الأسبوع.'
        };
    }

    if (lastNote && lastNote.length > 50) {
        return {
            title: 'صدى الكلمات ✍️',
            advice: 'شريكك كتب لك خاطرة عميقة مؤخراً. حاول قراءتها بتمعن والرد عليها بكلمة صادقة تظهر تقديرك لمشاعره.'
        };
    }

    return {
        title: 'بذرة مودة 🌱',
        advice: 'اليوم يوم هادئ. جرب أن تسأل شريكك عن شيء جديد تعلمه اليوم، أو ببساطة أخبره أنك تقدر وجوده في حياتك.'
    };
};
