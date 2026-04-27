import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            "welcome": "Welcome to Al-shifa Ayush",
            "onboarding": {
                "title": "Patient Onboarding",
                "description": "Please help us understand your health needs.",
                "therapy_type": "Preferred Therapy Type",
                "gender": "Self Identification",
                "ayurveda": "Ayurveda",
                "unani": "Unani",
                "homeopathy": "Homeopathy",
                "siddha": "Siddha",
                "yoga": "Yoga",
                "perfect": "You're all set!",
                "complete_description": "Your profile is updated. Let's begin your healing journey.",
                "genders": {
                    "male": "Male",
                    "female": "Female",
                    "other": "Other"
                },
                "steps": {
                    "0": { "title": "Basic Information", "subtitle": "Help us personalize your experience" },
                    "1": { "title": "Sleep Patterns", "subtitle": "Sleep is crucial for your healing journey" },
                    "2": { "title": "Pain Assessment", "subtitle": "Tell us where it hurts and how much" }
                }
            },
            "chat": {
                "title": "Secure Messaging",
                "placeholder": "Type a message...",
                "send": "Send"
            },
            "triage": {
                "title": "Health Assessment",
                "chief_complaint": "What brings you in today?",
                "pain_regions": "Where does it hurt?",
                "medical_context": "Medical Context",
                "lifestyle": "Lifestyle & Wellness",
                "review": "Review & Submit",
                "submit": "Submit Assessment",
                "result": "Triage Assessment",
                "book_consultation": "Book a Consultation",
                "urgency": {
                    "routine": "Routine",
                    "moderate": "Moderate",
                    "urgent": "Urgent",
                    "critical": "Critical"
                }
            },
            "journey": {
                "title": "Treatment Journey",
                "wellness_score": "Wellness Score",
                "active_journey": "Active Journey",
                "milestones": "Milestones",
                "vitals": "Vitals",
                "tasks": "Today's Tasks",
                "log_vitals": "Log Vitals",
                "pain_level": "Pain Level",
                "mood": "Mood",
                "builder_title": "Create Treatment Journey",
                "add_phase": "Add Phase",
                "add_task": "Add Task",
                "add_milestone": "Add Milestone"
            },
            "wellness": {
                "dashboard": "Wellness Dashboard",
                "zen_points": "Zen Points",
                "streak": "Day Streak",
                "quick_vital_log": "Quick Vital Log"
            },
            "nav": {
                "dashboard": "Dashboard",
                "appointments": "Appointments",
                "wellness": "Wellness",
                "triage": "Triage",
                "prescriptions": "Prescriptions",
                "reports": "Reports",
                "chat": "Chat",
                "settings": "Settings"
            },
            "today": {
                "greeting_morning": "Good morning",
                "greeting_afternoon": "Good afternoon",
                "greeting_evening": "Good evening",
                "subtitle": "Here's what matters today.",
                "cards": {
                    "tasks": "Today's tasks",
                    "medications": "Today's medications",
                    "vitals": "Vitals",
                    "pain_map": "Pain map",
                    "zen": "Zen Points",
                    "smart_messages": "Smart messages",
                    "journey": "Treatment journey",
                    "breathe": "Breathe",
                    "records": "My Records"
                },
                "empty": {
                    "no_prescriptions": "No active prescriptions.",
                    "no_pain": "No active pain points logged.",
                    "no_messages": "No messages.",
                    "no_vitals_prescribed": "No vitals to track yet",
                    "no_vitals_prescribed_body": "Your doctor hasn't prescribed any vitals to track. They'll appear here once added during your next consultation."
                },
                "checkin": {
                    "title": "Daily check-in",
                    "mood_prompt": "How's your overall mood today?",
                    "pain_prompt": "Pain level (0–10)",
                    "pain_hint": "0 = none, 10 = worst imaginable",
                    "sleep_prompt": "How was your sleep last night?"
                },
                "prescribed_vitals": {
                    "title": "Prescribed Vitals",
                    "empty": "No vitals prescribed yet. Use Add to specify which vitals this patient should track daily.",
                    "add": "Add",
                    "choose_type": "Choose vital to track"
                },
                "consultation_feedback": {
                    "banner_title": "How was your consultation?",
                    "banner_body": "A few quick questions about your visit with Dr. {{doctor}} — under a minute.",
                    "cta_open": "Share feedback",
                    "cta_dismiss": "Dismiss",
                    "opening_title": "That was a good consultation.",
                    "opening_body": "We'd love to hear how it went — just a few quick questions about your visit with Dr. {{doctor}}. It will take less than a minute.",
                    "opening_continue": "Continue",
                    "opening_later": "Maybe later",
                    "q_emotional": "How did Dr. {{doctor}} make you feel during the consultation?",
                    "q_confidence": "How do you feel about what comes next in your treatment?",
                    "q_listening": "Did the doctor listen to what you were saying?",
                    "q_return": "Next time you need care, would you want to see Dr. {{doctor}} again?",
                    "skip": "Skip",
                    "next": "Next",
                    "submit": "Submit",
                    "submitting": "Submitting…",
                    "closing_title": "Thank you.",
                    "closing_body": "Your feedback helps us make IWIS better for you and for every patient who follows.",
                    "done": "Done",
                    "question_n_of_4": "Question {{n}} of 4"
                },
                "journey_feedback": {
                    "opening_title": "Your treatment journey is complete.",
                    "opening_body": "Thank you for trusting us with your care.",
                    "opening_continue": "Continue",
                    "opening_later": "Maybe later",
                    "photos_title": "Looking back",
                    "mcq_appointments": "Were you able to book appointments when you needed them?",
                    "mcq_reminders": "Did the reminders and messages from IWIS help you stay on track with your treatment?",
                    "mcq_medications": "How was your experience getting your prescribed medications?",
                    "mcq_family": "If a family member had the same condition, would you bring them to IWIS for treatment?",
                    "garden_title": "How much has your health grown?",
                    "garden_subtitle": "Looking at where you are now compared to when you started.",
                    "face_title": "How did you feel about the care you received from your team?",
                    "card_title": "A note for Dr. {{doctor}}",
                    "card_body": "Is there anything you'd like Dr. {{doctor}} to know? A thank you, a reflection, something they might not have realised? We'll make sure they see it.",
                    "card_visibility_label": "Show on the team recognition board",
                    "card_visibility_hint": "Off by default — only Dr. {{doctor}} will see it.",
                    "card_send_finish": "Send & finish",
                    "card_finish": "Finish",
                    "card_sending": "Sending…",
                    "closing_title": "Thank you for letting us be part of your journey.",
                    "closing_body": "Wishing you continued good health.",
                    "skip": "Skip",
                    "skip_section": "Skip these questions",
                    "next": "Next",
                    "continue": "Continue",
                    "done": "Done",
                    "step_n_of_total": "Step {{current}} of {{total}}"
                },
                "recognition_panel": {
                    "title": "This Week's Recognition",
                    "letters_one": "{{count}} letter",
                    "letters_other": "{{count}} letters"
                }
            }
        }
    },
    ta: {
        translation: {
            "welcome": "அல்-ஷிபா ஆயுலுக்கு வரவேற்கிறோம்",
            "onboarding": {
                "title": "நோயாளி பதிவு",
                "description": "உங்கள் சுகாதாரத் தேவைகளைப் புரிந்துகொள்ள எங்களுக்கு உதவுங்கள்.",
                "therapy_type": "விருப்பமான சிகிச்சை முறை",
                "gender": "சுய அடையாளம்",
                "ayurveda": "ஆயுர்வேதம்",
                "unani": "யுனானி",
                "homeopathy": "ஹோமியோபதி",
                "siddha": "சித்தா",
                "yoga": "யோகா",
                "perfect": "எல்லாம் தயார்!",
                "complete_description": "உங்கள் சுயவிவரம் புதுப்பிக்கப்பட்டது. உங்கள் குணமாக்கும் பயணத்தைத் தொடங்குவோம்.",
                "genders": {
                    "male": "ஆண்",
                    "female": "பெண்",
                    "other": "மற்றவை"
                },
                "steps": {
                    "0": { "title": "அடிப்படைத் தகவல்", "subtitle": "நாங்கள் உங்கள் அனுபவத்தை தனிப்பயனாக்க விரும்புகிறோம்" },
                    "1": { "title": "தூக்க முறைகள்", "subtitle": "உங்கள் குணமடைய தூக்கம் மிகவும் முக்கியமானது" },
                    "2": { "title": "வலி மதிப்பீடு", "subtitle": "எங்களுக்கு எங்கு வலிக்கிறது மற்றும் எவ்வளவு என்று சொல்லுங்கள்" }
                }
            },
            "chat": {
                "title": "பாதுகாப்பான செய்திகள்",
                "placeholder": "செய்தியைத் தட்டச்சு செய்க...",
                "send": "அனுப்பு"
            },
            "triage": {
                "title": "சுகாதார மதிப்பீடு",
                "chief_complaint": "இன்று என்ன பிரச்சனை?",
                "pain_regions": "எங்கு வலிக்கிறது?",
                "medical_context": "மருத்துவ பின்னணி",
                "lifestyle": "வாழ்க்கை முறை & ஆரோக்கியம்",
                "review": "ஆய்வு & சமர்ப்பிக்கவும்",
                "submit": "மதிப்பீட்டை சமர்ப்பிக்கவும்",
                "result": "தரவரிசை மதிப்பீடு",
                "book_consultation": "ஆலோசனை பதிவு செய்",
                "urgency": {
                    "routine": "வழக்கமான",
                    "moderate": "மிதமான",
                    "urgent": "அவசரம்",
                    "critical": "முக்கியமான"
                }
            },
            "journey": {
                "title": "சிகிச்சை பயணம்",
                "wellness_score": "ஆரோக்கிய மதிப்பெண்",
                "active_journey": "செயல்பாட்டில் உள்ள பயணம்",
                "milestones": "மைல்கற்கள்",
                "vitals": "உடல் அளவீடுகள்",
                "tasks": "இன்றைய பணிகள்",
                "log_vitals": "உடல் அளவீடுகளை பதிவிடு",
                "pain_level": "வலி நிலை",
                "mood": "மனநிலை",
                "builder_title": "சிகிச்சை பயணம் உருவாக்கு",
                "add_phase": "கட்டம் சேர்",
                "add_task": "பணி சேர்",
                "add_milestone": "மைல்கல் சேர்"
            },
            "wellness": {
                "dashboard": "ஆரோக்கிய டாஷ்போர்டு",
                "zen_points": "ஜென் புள்ளிகள்",
                "streak": "தினசரி தொடர்",
                "quick_vital_log": "விரைவு உடல் அளவீடு பதிவு"
            },
            "nav": {
                "dashboard": "டாஷ்போர்டு",
                "appointments": "நேர நிர்ணயம்",
                "wellness": "ஆரோக்கியம்",
                "triage": "தரவரிசை",
                "prescriptions": "மருந்து சீட்டு",
                "reports": "அறிக்கைகள்",
                "chat": "செய்தி",
                "settings": "அமைப்புகள்"
            },
            "today": {
                "greeting_morning": "காலை வணக்கம்",
                "greeting_afternoon": "மதிய வணக்கம்",
                "greeting_evening": "மாலை வணக்கம்",
                "subtitle": "இன்றைக்கு முக்கியமானவை இதோ.",
                "cards": {
                    "tasks": "இன்றைய பணிகள்",
                    "medications": "இன்றைய மருந்துகள்",
                    "vitals": "உடல் அளவீடுகள்",
                    "pain_map": "வலி வரைபடம்",
                    "zen": "ஜென் புள்ளிகள்",
                    "smart_messages": "ஸ்மார்ட் செய்திகள்",
                    "journey": "சிகிச்சை பயணம்",
                    "breathe": "மூச்சு",
                    "records": "என் பதிவுகள்"
                },
                "empty": {
                    "no_prescriptions": "செயலில் உள்ள மருந்துகள் இல்லை.",
                    "no_pain": "செயலில் உள்ள வலி புள்ளிகள் பதிவாகவில்லை.",
                    "no_messages": "செய்திகள் இல்லை.",
                    "no_vitals_prescribed": "கண்காணிக்க உடல் அளவீடுகள் எதுவுமில்லை",
                    "no_vitals_prescribed_body": "உங்கள் மருத்துவர் இன்னும் எந்த உடல் அளவீடுகளையும் பரிந்துரைக்கவில்லை. அடுத்த ஆலோசனையின் போது சேர்க்கப்படும்."
                },
                "checkin": {
                    "title": "தினசரி பதிவு",
                    "mood_prompt": "இன்று உங்கள் ஒட்டுமொத்த மனநிலை எப்படி உள்ளது?",
                    "pain_prompt": "வலி நிலை (0–10)",
                    "pain_hint": "0 = இல்லை, 10 = மோசமானது",
                    "sleep_prompt": "நேற்றிரவு உங்கள் தூக்கம் எப்படி இருந்தது?"
                },
                "prescribed_vitals": {
                    "title": "பரிந்துரைக்கப்பட்ட உடல் அளவீடுகள்",
                    "empty": "இன்னும் உடல் அளவீடுகள் பரிந்துரைக்கப்படவில்லை. இந்த நோயாளி தினசரி எந்த அளவீடுகளைக் கண்காணிக்க வேண்டும் என்பதைக் குறிப்பிட Add ஐ பயன்படுத்தவும்.",
                    "add": "சேர்",
                    "choose_type": "கண்காணிக்க உடல் அளவீட்டைத் தேர்ந்தெடுக்கவும்"
                },
                "consultation_feedback": {
                    "banner_title": "உங்கள் ஆலோசனை எப்படி இருந்தது?",
                    "banner_body": "மரு. {{doctor}} அவர்களுடனான உங்கள் சந்திப்பு பற்றிய சில விரைவான கேள்விகள் — ஒரு நிமிடத்திற்குள்.",
                    "cta_open": "கருத்து பகிர்",
                    "cta_dismiss": "மறை",
                    "opening_title": "அது ஒரு நல்ல ஆலோசனையாக இருந்தது.",
                    "opening_body": "அது எப்படி இருந்தது என்பதை நாங்கள் கேட்க விரும்புகிறோம் — மரு. {{doctor}} அவர்களுடனான உங்கள் சந்திப்பு பற்றி சில விரைவான கேள்விகள். ஒரு நிமிடத்திற்கும் குறைவாக ஆகும்.",
                    "opening_continue": "தொடர்க",
                    "opening_later": "பின்னர்",
                    "q_emotional": "ஆலோசனையின் போது மரு. {{doctor}} உங்களை எப்படி உணரச் செய்தார்?",
                    "q_confidence": "உங்கள் சிகிச்சையில் அடுத்து என்ன வருகிறது என்பது பற்றி எப்படி உணர்கிறீர்கள்?",
                    "q_listening": "நீங்கள் சொன்னதை மருத்துவர் கேட்டாரா?",
                    "q_return": "அடுத்த முறை உங்களுக்கு பராமரிப்பு தேவைப்படும்போது, மரு. {{doctor}} அவர்களையே மீண்டும் பார்க்க விரும்புவீர்களா?",
                    "skip": "தவிர்",
                    "next": "அடுத்து",
                    "submit": "சமர்ப்பி",
                    "submitting": "சமர்ப்பிக்கிறது…",
                    "closing_title": "நன்றி.",
                    "closing_body": "உங்கள் கருத்து உங்களுக்கும், பின் வரும் ஒவ்வொரு நோயாளிக்கும் IWIS ஐ மேம்படுத்த எங்களுக்கு உதவுகிறது.",
                    "done": "முடிந்தது",
                    "question_n_of_4": "கேள்வி {{n}} / 4"
                },
                "journey_feedback": {
                    "opening_title": "உங்கள் சிகிச்சை பயணம் முடிந்துவிட்டது.",
                    "opening_body": "உங்கள் பராமரிப்பை எங்களிடம் ஒப்படைத்ததற்கு நன்றி.",
                    "opening_continue": "தொடர்க",
                    "opening_later": "பின்னர்",
                    "photos_title": "திரும்பிப் பார்த்தல்",
                    "mcq_appointments": "உங்களுக்குத் தேவைப்படும்போது நேரங்களை முன்பதிவு செய்ய முடிந்ததா?",
                    "mcq_reminders": "IWIS அனுப்பிய நினைவூட்டல்கள் உங்கள் சிகிச்சைக்கு உதவியதா?",
                    "mcq_medications": "பரிந்துரைக்கப்பட்ட மருந்துகளைப் பெறுவதில் உங்கள் அனுபவம் எப்படி இருந்தது?",
                    "mcq_family": "ஒரே நிலையில் உள்ள உங்கள் குடும்ப உறுப்பினரை IWIS க்கு அழைத்துச் செல்வீர்களா?",
                    "garden_title": "உங்கள் ஆரோக்கியம் எவ்வளவு வளர்ந்துள்ளது?",
                    "garden_subtitle": "தொடங்கியபோதிலிருந்து இப்போது நீங்கள் இருக்கும் இடத்தை ஒப்பிட்டுப் பாருங்கள்.",
                    "face_title": "உங்கள் குழுவிடமிருந்து நீங்கள் பெற்ற பராமரிப்பு பற்றி எப்படி உணர்ந்தீர்கள்?",
                    "card_title": "மரு. {{doctor}} க்கு ஒரு குறிப்பு",
                    "card_body": "மரு. {{doctor}} தெரிந்துகொள்ள வேண்டும் என்று நீங்கள் விரும்புவது ஏதேனும் உள்ளதா? ஒரு நன்றி, ஒரு பிரதிபலிப்பு, அவர்கள் கவனிக்காத ஏதேனும்? அது அவர்களுக்கு சேரும்.",
                    "card_visibility_label": "குழு அங்கீகார பலகையில் காண்பி",
                    "card_visibility_hint": "இயல்பாக ஆஃப் — மரு. {{doctor}} மட்டுமே பார்ப்பார்.",
                    "card_send_finish": "அனுப்பி முடி",
                    "card_finish": "முடி",
                    "card_sending": "அனுப்புகிறது…",
                    "closing_title": "உங்கள் பயணத்தில் ஒரு பகுதியாக இருக்க அனுமதித்ததற்கு நன்றி.",
                    "closing_body": "தொடர்ந்து நல்ல ஆரோக்கியம் வாய்க்கட்டும்.",
                    "skip": "தவிர்",
                    "skip_section": "இக்கேள்விகளைத் தவிர்",
                    "next": "அடுத்து",
                    "continue": "தொடர்க",
                    "done": "முடிந்தது",
                    "step_n_of_total": "படி {{current}} / {{total}}"
                },
                "recognition_panel": {
                    "title": "இந்த வாரத்தின் அங்கீகாரம்",
                    "letters_one": "{{count}} கடிதம்",
                    "letters_other": "{{count}} கடிதங்கள்"
                }
            }
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "en",
        fallbackLng: "en",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
