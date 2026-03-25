import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Camera, 
  Search, 
  Plus, 
  User, 
  Phone, 
  Trash2, 
  Loader2, 
  X,
  CreditCard,
  History,
  CheckCircle2,
  Mail
} from 'lucide-react';

// --- 본인의 Firebase 설정값 ---
const firebaseConfig = {
  apiKey: "AIzaSyAePC3ggBJ87p8_uc2KEEcr1m0nhG0Y7d0",
  authDomain: "my-card-wallet-f11bc.firebaseapp.com",
  projectId: "my-card-wallet-f11bc",
  storageBucket: "my-card-wallet-f11bc.firebasestorage.app",
  messagingSenderId: "770841138415",
  appId: "1:770841138415:web:e8473fcc1e83def0aa371a"
};

// --- [중요] 본인의 Gemini API 키를 여기에 입력하세요 ---
const apiKey = "여기에_본인의_API_키를_입력하세요"; 
const appId = "my-card-wallet-f11bc";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState('list');
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const cardsRef = collection(db, 'artifacts', appId, 'public', 'data', 'businessCards');
    const q = query(cardsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cardList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCards(cardList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    }, (error) => {
      console.error("Firestore 에러:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 이미지 리사이징 (용량 초과 방지)
  const resizeImage = (base64Str) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const analyzeImage = async (base64Data) => {
    if (!user) return;
    setIsProcessing(true);
    setStatusMsg("AI가 정보를 분석 중입니다...");

    try {
      const optimizedImage = await resizeImage(base64Data);
      const prompt = "명함 이미지에서 이름(name), 회사(company), 직책(position), 전화번호(phone), 이메일(email)을 추출해 JSON으로 응답해줘.";

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: optimizedImage.split(',')[1] } }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const result = await response.json();
      const extracted = JSON.parse(result.candidates[0].content.parts[0].text);
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'businessCards'), {
        ...extracted,
        userId: user.uid,
        createdAt: Date.now(),
        image: optimizedImage
      });

      setStatusMsg("성공적으로 저장되었습니다!");
      setTimeout(() => { setIsProcessing(false); setStatusMsg(null); setView('list'); }, 1000);
    } catch (error) {
      console.error(error);
      setStatusMsg("분석 중 오류가 발생했습니다.");
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => analyzeImage(reader.result);
    reader.readAsDataURL(file);
  };

  const filteredCards = useMemo(() => {
    return cards.filter(card => 
      (card.name || "").includes(searchTerm) || (card.company || "").includes(searchTerm)
    );
  }, [cards, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white"><CreditCard size={20}/></div>
          <h1 className="text-lg font-bold">내 명함 지갑</h1>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {view === 'list' ? (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <input 
                type="text" placeholder="검색..." 
                className="w-full bg-white border rounded-xl py-3 pl-10 pr-4 shadow-sm"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-4">
              {filteredCards.map(card => (
                <div key={card.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                    {card.image && <img src={card.image} className="w-full h-full object-cover"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800">{card.name}</h3>
                    <p className="text-blue-600 text-xs font-semibold">{card.company}</p>
                    <p className="text-slate-400 text-[11px]">{card.phone}</p>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'businessCards', card.id))}>
                    <Trash2 size={16} className="text-slate-200 hover:text-red-400"/>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl p-8 shadow-sm border text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Camera size={40}/></div>
            <h2 className="text-xl font-bold mb-4">명함 추가하기</h2>
            <label className="block w-full cursor-pointer bg-blue-600 text-white rounded-2xl py-4 font-bold shadow-lg">
              명함 촬영 및 업로드
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload}/>
            </label>
            <button onClick={() => setView('list')} className="mt-6 text-slate-400 text-sm">목록으로 돌아가기</button>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xs text-center shadow-2xl">
            {statusMsg?.includes("성공") ? <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4"/> : <Loader2 size={48} className="text-blue-600 mx-auto mb-4 animate-spin"/>}
            <p className="font-bold text-slate-800">{statusMsg}</p>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t px-10 py-4 flex justify-around items-center">
        <button onClick={() => setView('list')} className={view === 'list' ? 'text-blue-600' : 'text-slate-400'}><History size={22}/></button>
        <button onClick={() => setView('add')} className="bg-blue-600 text-white w-14 h-14 rounded-full -mt-10 shadow-lg flex items-center justify-center">
          {view === 'add' ? <X size={28}/> : <Plus size={28}/>}
        </button>
        <button className="text-slate-400"><User size={22}/></button>
      </nav>
    </div>
  );
}
