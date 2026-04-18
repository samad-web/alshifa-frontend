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
