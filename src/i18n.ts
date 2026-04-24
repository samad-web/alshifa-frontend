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
