import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { Skull, Shield, Moon, Sun, Scroll, Play, UserPlus, Flame, Search, Globe, Cat, UserCheck, MessageSquare, Eye, RefreshCw } from 'lucide-react';

// ==========================================
// 🚀 第一步：请在这里填入你自己的 Firebase 配置
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB6eQDaVvrzI9AD3lQYQeWGWuIspmXPIbM",
  authDomain: "salem-a3310.firebaseapp.com",
  projectId: "salem-a3310",
  storageBucket: "salem-a3310.firebasestorage.app",
  messagingSenderId: "329781436634",
  appId: "1:329781436634:web:62a0a3ee64c79fcd4ec5e3"
};

// --- Gemini AI Configuration ---
const apiKey = "YOUR_GEMINI_API_KEY"; // 可选：填入你的 Gemini API Key 以激活猎巫人

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CARD_TYPES = { RED: 'red', GREEN: 'green', BLACK: 'black' };
const ROLES = { PEASANT: '平民', WITCH: '女巫', CONSTABLE: '治安官' };

// --- 角色系统 (Characters) ---
const CHARACTERS = [
  { id: 'c1', name: '大力士', desc: '需要 8 点指控才会受到审判。', threshold: 8 },
  { id: 'c2', name: '镇长', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c3', name: '先知', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c4', name: '铁匠', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c5', name: '医生', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c6', name: '农夫', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c7', name: '猎人', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c8', name: '修女', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c9', name: '牧师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c10', name: '裁缝', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c11', name: '乞丐', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c12', name: '厨师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c13', name: '教师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c14', name: '守夜人', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c15', name: '商人', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
];

// --- 牌库配置 ---
const DECK_TEMPLATE = [
  ...Array(15).fill({ type: CARD_TYPES.RED, name: '指控', effect: 1, desc: '目标玩家增加 1 点指控值' }),
  ...Array(5).fill({ type: CARD_TYPES.RED, name: '铁证', effect: 3, desc: '目标玩家增加 3 点指控值' }),
  ...Array(1).fill({ type: CARD_TYPES.RED, name: '目击', effect: 7, desc: '致命一击！目标玩家直接增加 7 点指控值' }),
  ...Array(8).fill({ type: CARD_TYPES.GREEN, name: '不在场证明', effect: -1, desc: '目标玩家减少 1 点指控值' }),
  ...Array(4).fill({ type: CARD_TYPES.GREEN, name: '替罪羊', effect: 'transfer', desc: '将你身上的所有指控转移给目标' }),
];

const CONSPIRACY_CARDS = [
  { type: CARD_TYPES.BLACK, name: '传染(阴谋)', effect: 'conspiracy', desc: '每人选择左侧玩家的一张身份牌' }
];

const NIGHT_CARD = { type: CARD_TYPES.BLACK, name: '黑夜降临', effect: 'night', desc: '立即进入黑夜阶段' };

const shuffle = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray.map(item => ({ ...item, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
};

export default function SalemGameV3() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interaction States
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Connection (公网版去除了复杂的跨域 appId，只需纯粹的 RoomID)
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || Math.random().toString(36).substring(2, 8).toUpperCase();
  });
  const [joinInput, setJoinInput] = useState(''); 
  const getRoomPath = () => ['salem_rooms'];

  // Witch Chat
  const [witchChatInput, setWitchChatInput] = useState('');
  const chatMessagesEndRef = useRef(null);

  // AI
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [ghostMessageUsed, setGhostMessageUsed] = useState(false);

  // 新增：用于显示抽牌结果的本地状态弹窗
  const [showConspiracyResult, setShowConspiracyResult] = useState(null);

  // --- Auth ---
  useEffect(() => {
    // 公网版采用最稳定的纯匿名登录
    signInAnonymously(auth).catch(err => {
      console.error("Auth err", err);
      setError("身份认证失败，请检查 Firebase 配置。");
      setLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !playerName) setPlayerName(`镇民_${u.uid.substring(0, 4)}`);
    });
    return () => unsubscribe();
  }, []);

  // --- Sync Game State ---
  useEffect(() => {
    if (!user || !roomId) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    setLoading(true);
    setError('');
    
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      } else {
        const initialData = {
          status: 'lobby',
          players: {},
          turnOrder: [],
          currentTurnIndex: 0,
          hasPlayedCardThisTurn: false,
          deck: [],
          discard: [],
          log: ['房间已建立。等待玩家加入...'],
          nightActions: {},
          conspiracyActions: {},
          privateLogs: {}, 
          winner: null,
          blackCatTarget: null,
          witchChat: [] 
        };
        setGameState(initialData); 
        setDoc(roomRef, initialData).catch((e) => {
          console.error(e);
          setError("数据库写入失败，请检查 Firestore 安全规则是否已开放。");
        });
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("连接服务器失败，请刷新。");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, roomId]);

  // Scroll witch chat to bottom
  useEffect(() => {
    if (gameState?.status === 'night' || gameState?.status === 'night0') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.witchChat, gameState?.status]);

  // 新增：监听并显示身份窃取的私密通知弹窗
  useEffect(() => {
    if (gameState?.privateLogs && user?.uid && gameState.privateLogs[user.uid]) {
      setShowConspiracyResult(gameState.privateLogs[user.uid]);
    }
  }, [gameState?.privateLogs, user?.uid]);

  // --- Lobby Actions ---
  const joinGame = async () => {
    if (!user || !gameState) return;
    if (gameState.status !== 'lobby') return alert("游戏已开始！您将以观战模式进入。");
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      [`players.${user.uid}`]: {
        uid: user.uid,
        name: playerName,
        character: null,
        tryx: [], 
        hand: [],
        accusations: 0,
        isDead: false,
      },
      turnOrder: [...(gameState.turnOrder || []), user.uid].filter((v, i, a) => a.indexOf(v) === i),
      log: [...(gameState.log || []), `${playerName} 加入了。`]
    });
  };

  const leaveGame = async () => {
    if (!user || !gameState) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    const newPlayers = { ...gameState.players };
    delete newPlayers[user.uid];
    const newTurnOrder = (gameState.turnOrder || []).filter(uid => uid !== user.uid);
    await updateDoc(roomRef, {
      players: newPlayers,
      turnOrder: newTurnOrder,
      log: [...(gameState.log || []), `${playerName} 离开了小镇。`]
    });
  };

  const handleJoinInput = () => {
    const val = joinInput.trim();
    if (!val) return;

    try {
      const url = new URL(val);
      const r = url.searchParams.get('room');
      if (r) {
        if (r === roomId) {
          alert("你已经在这个房间里啦！");
          setJoinInput('');
          return;
        }
        setLoading(true);
        setRoomId(r); 
        setJoinInput('');
      } else alert("无效链接，缺少房间参数。");
    } catch { 
      const r = val.toUpperCase();
      if (r === roomId) {
        alert("你已经在这个房间里啦！");
        setJoinInput('');
        return;
      }
      setLoading(true);
      setRoomId(r);
      setJoinInput('');
    }
  };

  // --- Game Setup ---
  const startGame = async () => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder.length < 3) return alert("至少3人！");
    
    const pCount = gameState.turnOrder.length;
    const witchCount = pCount >= 12 ? 4 : (pCount >= 9 ? 3 : (pCount >= 6 ? 2 : 1));
    let tryxPool = shuffle([
      ...Array(witchCount).fill({ role: ROLES.WITCH }),
      { role: ROLES.CONSTABLE },
      ...Array((pCount * 3) - witchCount - 1).fill({ role: ROLES.PEASANT })
    ]);

    let charPool = shuffle([...CHARACTERS]).slice(0, pCount);

    const playersUpdate = { ...(gameState.players || {}) };
    gameState.turnOrder.forEach(uid => {
      if (!playersUpdate[uid]) return;
      playersUpdate[uid].character = charPool.pop() || { id: 'c_default', name: '无名之辈', desc: '需要 7 点指控才会受到审判。', threshold: 7 };
      playersUpdate[uid].tryx = [tryxPool.pop(), tryxPool.pop(), tryxPool.pop()].map(t => ({...t, revealed: false, id: Math.random().toString()}));
      playersUpdate[uid].hand = [];
      playersUpdate[uid].accusations = 0;
      playersUpdate[uid].isDead = false;
    });

    let baseDeck = shuffle(DECK_TEMPLATE);
    gameState.turnOrder.forEach(uid => {
      if (playersUpdate[uid]) {
         playersUpdate[uid].hand = [baseDeck.pop(), baseDeck.pop(), baseDeck.pop()];
      }
    });

    let finalDeck = shuffle([...baseDeck, ...CONSPIRACY_CARDS.map(c => ({...c, id: Math.random().toString()}))]);
    finalDeck.unshift({...NIGHT_CARD, id: 'final_night'}); 

    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      status: 'night0',
      players: playersUpdate,
      deck: finalDeck,
      discard: [],
      currentTurnIndex: 0,
      hasPlayedCardThisTurn: false,
      log: ['游戏开始！塞勒姆镇迎来了第0个夜晚... 女巫们正在决定把黑猫放在谁的家门口。'],
      nightActions: {},
      blackCatTarget: null,
      witchChat: [] 
    });
  };

  const addLog = (msg, currentLog) => {
    const newLog = [...(currentLog || [])];
    newLog.push(`[${new Date().toLocaleTimeString('en-US',{hour12:false})}] ${msg}`);
    if (newLog.length > 20) newLog.shift();
    return newLog;
  };

  // --- Win Check ---
  const checkWinCondition = (currentPlayers) => {
    if (!currentPlayers) return null;
    const alivePlayers = Object.values(currentPlayers).filter(p => p && !p.isDead);
    if(alivePlayers.length === 0) return '平局！小镇毁灭了。';
    const allLivingAreWitches = alivePlayers.every(p => p?.tryx?.some(t => t.role === ROLES.WITCH));
    if (allLivingAreWitches) return '女巫阵营胜利！';
    const allWitchRevealed = Object.values(currentPlayers).every(p => p?.tryx?.every(t => t.role !== ROLES.WITCH || t.revealed));
    if (allWitchRevealed) return '平民阵营胜利！';
    return null;
  };

  // --- Turn Progression ---
  const nextTurn = async (forcedLog = null) => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder.length === 0) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    let nextIdx = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
    let nextUid = gameState.turnOrder[nextIdx];
    
    let loops = 0;
    while (gameState.players[nextUid]?.isDead && loops < gameState.turnOrder.length) {
      nextIdx = (nextIdx + 1) % gameState.turnOrder.length;
      nextUid = gameState.turnOrder[nextIdx];
      loops++;
    }

    let winner = checkWinCondition(gameState.players);
    await updateDoc(roomRef, {
      currentTurnIndex: nextIdx,
      hasPlayedCardThisTurn: false,
      log: forcedLog ? forcedLog : addLog(`现在是 ${gameState.players[nextUid]?.name || '未知玩家'} 的回合。`, gameState.log),
      ...(winner ? { status: 'gameover', winner } : {})
    });
  };

  // --- Day Actions ---
  const handleDrawCards = async () => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder[gameState.currentTurnIndex] !== user.uid) return;
    
    let currentDeck = [...(gameState.deck || [])];
    let currentDiscard = [...(gameState.discard || [])];
    let myHand = [...(gameState.players[user.uid]?.hand || [])];
    let currentLog = [...(gameState.log || [])];
    
    const drawOne = () => {
      if (currentDeck.length === 0) {
        currentDeck = shuffle(currentDiscard);
        currentDiscard = [];
        currentLog = addLog(`牌库已空，洗牌重置。(黑夜和传染牌不再加入)`, currentLog);
      }
      return currentDeck.pop();
    };

    const card1 = drawOne();
    const card2 = drawOne();
    const drawnCards = [card1, card2].filter(c => c);

    let blackCardTriggered = null;

    drawnCards.forEach(c => {
      if (c.type === CARD_TYPES.BLACK) {
        blackCardTriggered = c;
        currentDiscard.push(c); 
      } else {
        myHand.push(c);
      }
    });

    const roomRef = doc(db, ...getRoomPath(), roomId);
    const updates = { deck: currentDeck, discard: currentDiscard, [`players.${user.uid}.hand`]: myHand };

    if (blackCardTriggered) {
      currentLog = addLog(`😱 ${playerName} 抽到了【${blackCardTriggered.name}】！`, currentLog);
      updates.log = currentLog;
      
      if (blackCardTriggered.effect === 'night') {
        updates.status = 'night';
        updates.nightActions = {}; 
        updates.witchChat = []; 
        await updateDoc(roomRef, updates);
        return; 
      } else if (blackCardTriggered.effect === 'conspiracy') {
        updates.status = 'conspiracy';
        updates.conspiracyActions = {};
        currentLog = addLog(`🌪️ 唯一一次传染爆发！每位存活玩家必须从左侧玩家处抽取一张身份牌！`, currentLog);
        updates.log = currentLog;
        await updateDoc(roomRef, updates);
        return;
      }
    } else {
      currentLog = addLog(`${playerName} 抽取了 2 张牌。`, currentLog);
      updates.log = currentLog;
    }

    await updateDoc(roomRef, updates);
    if (!blackCardTriggered) nextTurn(updates.log);
  };

  const triggerTrial = (targetUid, currentPlayers, currentLog) => {
    const target = currentPlayers[targetUid];
    if (!target || !target.tryx) return { updatedTarget: target, updatedLog: currentLog }; 

    const unrevealed = target.tryx.map((t, i) => ({...t, index: i})).filter(t => !t.revealed);
    
    if (unrevealed.length > 0) {
      const toReveal = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      target.tryx[toReveal.index].revealed = true;
      currentLog = addLog(`⚖️ ${target.name} 受到了审判！被迫翻开了一张身份：【${target.tryx[toReveal.index].role}】`, currentLog);
      target.accusations = 0; 
      
      if (target.tryx.every(t => t.revealed)) {
        target.isDead = true;
        currentLog = addLog(`💀 ${target.name} 的身份已全部曝光，被送上了绞刑架！`, currentLog);
      }
    }
    return { updatedTarget: target, updatedLog: currentLog };
  };

  const playCard = async () => {
    if (!selectedCard || !selectedTarget || !gameState) return;
    
    let currentPlayers = JSON.parse(JSON.stringify(gameState.players));
    if (!currentPlayers[user.uid] || !currentPlayers[selectedTarget]) return; 

    let myHand = currentPlayers[user.uid].hand || [];
    let currentLog = [...(gameState.log || [])];
    let currentDiscard = [...(gameState.discard || [])];

    const cardIndex = myHand.findIndex(c => c.id === selectedCard.id);
    if (cardIndex === -1) return;
    myHand.splice(cardIndex, 1);
    currentDiscard.push(selectedCard);

    let targetPlayer = currentPlayers[selectedTarget];
    let logMsg = `${playerName} 对 ${targetPlayer.name} 使用了【${selectedCard.name}】。`;

    if (selectedCard.type === CARD_TYPES.RED) {
      targetPlayer.accusations = (targetPlayer.accusations || 0) + selectedCard.effect;
      logMsg += ` (${targetPlayer.name} 增加 ${selectedCard.effect} 指控)`;
    } else if (selectedCard.type === CARD_TYPES.GREEN) {
      if (selectedCard.effect === 'transfer') {
        targetPlayer.accusations = (targetPlayer.accusations || 0) + (currentPlayers[user.uid].accusations || 0);
        logMsg += ` (转移了 ${currentPlayers[user.uid].accusations || 0} 点指控)`;
        currentPlayers[user.uid].accusations = 0;
      } else {
        targetPlayer.accusations = (targetPlayer.accusations || 0) + selectedCard.effect;
        if (targetPlayer.accusations < 0) targetPlayer.accusations = 0;
        logMsg += ` (${targetPlayer.name} 指控 ${selectedCard.effect})`;
      }
    }
    currentLog = addLog(logMsg, currentLog);

    const threshold = targetPlayer.character?.threshold || 7;
    if (targetPlayer.accusations >= threshold) {
      const { updatedTarget, updatedLog } = triggerTrial(selectedTarget, currentPlayers, currentLog);
      targetPlayer = updatedTarget;
      currentLog = updatedLog;
    }

    setSelectedCard(null);
    setSelectedTarget(null);

    const winner = checkWinCondition(currentPlayers);
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      players: currentPlayers,
      discard: currentDiscard,
      log: currentLog,
      hasPlayedCardThisTurn: true,
      ...(winner ? { status: 'gameover', winner } : {})
    });
  };

  // --- Witch Chat ---
  const sendWitchMessage = async (e) => {
    e.preventDefault();
    if (!witchChatInput.trim() || !gameState) return;
    
    const roomRef = doc(db, ...getRoomPath(), roomId);
    const msg = {
      sender: playerName,
      text: witchChatInput.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {hour12:false})
    };
    
    await updateDoc(roomRef, {
      witchChat: arrayUnion(msg)
    });
    setWitchChatInput('');
  };

  // --- Night & Black Cat ---
  const submitNightAction = async (targetUid) => {
    if (!user) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, { [`nightActions.${user.uid}`]: targetUid || 'none' });
  };

  useEffect(() => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder.length === 0) return;
    
    if (gameState.status === 'night0' && gameState.turnOrder[0] === user.uid) {
      const witches = gameState.turnOrder.filter(uid => gameState.players[uid]?.tryx?.some(t => t.role === ROLES.WITCH));
      const allWitchesSubmitted = witches.every(uid => gameState.nightActions && gameState.nightActions[uid]);
      if (allWitchesSubmitted && witches.length > 0) resolveNight0();
      else if (witches.length === 0) resolveNight0(true);
    }
    
    if (gameState.status === 'night' && gameState.turnOrder[0] === user.uid) {
      const alivePlayers = gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead);
      if (alivePlayers.length > 0 && alivePlayers.every(uid => gameState.nightActions && gameState.nightActions[uid])) resolveNightPhase();
    }
    
    if (gameState.status === 'conspiracy' && gameState.turnOrder[0] === user.uid) {
      const alivePlayers = gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead);
      if (alivePlayers.length > 0 && alivePlayers.every(uid => gameState.conspiracyActions && gameState.conspiracyActions[uid] !== undefined)) resolveConspiracy();
    }
  }, [gameState?.nightActions, gameState?.conspiracyActions, gameState?.status]);

  const resolveNight0 = async (randomFallback = false) => {
    let currentLog = [...(gameState.log || [])];
    let catTarget = null;
    
    if (!randomFallback && gameState.nightActions) {
      let votes = {};
      Object.entries(gameState.nightActions).forEach(([uid, targetUid]) => {
        if(targetUid !== 'none') votes[targetUid] = (votes[targetUid] || 0) + 1;
      });
      let maxVotes = 0;
      Object.entries(votes).forEach(([uid, v]) => {
        if (v > maxVotes) { maxVotes = v; catTarget = uid; }
      });
    }
    
    if (!catTarget) {
      const alive = gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead);
      if (alive.length > 0) catTarget = alive[Math.floor(Math.random() * alive.length)];
    }

    if (catTarget && gameState.players[catTarget]) {
      currentLog = addLog(`天亮了。大家发现了一只黑猫（诅咒）正坐在 ${gameState.players[catTarget].name} 的门前。`, currentLog);
    }
    
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      status: 'day',
      log: currentLog,
      nightActions: {},
      blackCatTarget: catTarget,
      witchChat: [] 
    });
  };

  const resolveNightPhase = async () => {
    let currentPlayers = JSON.parse(JSON.stringify(gameState.players));
    let currentLog = [...(gameState.log || [])];
    let witchTargets = {};
    let constableProtected = null;

    if (gameState.nightActions) {
      Object.entries(gameState.nightActions).forEach(([uid, targetUid]) => {
        const p = currentPlayers[uid];
        if (!p || targetUid === 'none') return;
        if (p.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed)) witchTargets[targetUid] = (witchTargets[targetUid] || 0) + 1;
        if (p.tryx?.some(t => t.role === ROLES.CONSTABLE && !t.revealed)) constableProtected = targetUid;
      });
    }

    let killTarget = null, maxVotes = 0;
    Object.entries(witchTargets).forEach(([uid, votes]) => {
      if (votes > maxVotes) { maxVotes = votes; killTarget = uid; }
    });

    currentLog = addLog(`黎明到来。`, currentLog);

    if (killTarget && currentPlayers[killTarget]) {
      if (killTarget === constableProtected) {
        currentLog = addLog(`昨晚治安官成功保护了目标，是个平安夜。`, currentLog);
      } else {
        const target = currentPlayers[killTarget];
        target.isDead = true;
        if (target.tryx) target.tryx.forEach(t => t.revealed = true); 
        currentLog = addLog(`💀 昨晚，女巫袭击了 ${target.name}！惨死在血泊中。`, currentLog);
      }
    } else currentLog = addLog(`昨晚是个平安夜。`, currentLog);

    const winner = checkWinCondition(currentPlayers);
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      status: winner ? 'gameover' : 'day',
      players: currentPlayers, 
      log: currentLog, 
      nightActions: {}, 
      witchChat: [], 
      ...(winner ? { winner } : {})
    });
    if (!winner) nextTurn(currentLog);
  };

  const submitConspiracyAction = async (cardIndex) => {
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, { [`conspiracyActions.${user.uid}`]: cardIndex });
  };

  const resolveConspiracy = async () => {
    let currentPlayers = JSON.parse(JSON.stringify(gameState.players));
    let currentLog = [...(gameState.log || [])];
    const order = gameState.turnOrder || [];
    
    let cardsTaken = {}; 
    
    if (gameState.conspiracyActions) {
      order.forEach((myUid, idx) => {
        if (!currentPlayers[myUid]?.isDead) {
          let leftIdx = idx - 1;
          if (leftIdx < 0) leftIdx = order.length - 1;
          let leftUid = order[leftIdx];
          while (currentPlayers[leftUid]?.isDead && leftUid !== myUid) {
             leftIdx--;
             if (leftIdx < 0) leftIdx = order.length - 1;
             leftUid = order[leftIdx];
          }
          
          let targetCardIdx = gameState.conspiracyActions[myUid];
          if (targetCardIdx !== undefined && currentPlayers[leftUid]?.tryx) {
            let cardToTake = currentPlayers[leftUid].tryx[targetCardIdx];
            if (cardToTake) {
              cardsTaken[myUid] = { fromUid: leftUid, card: cardToTake, origIdx: targetCardIdx };
            }
          }
        }
      });
    }

    Object.values(cardsTaken).forEach(take => {
      if (currentPlayers[take.fromUid]?.tryx) {
        currentPlayers[take.fromUid].tryx.splice(take.origIdx, 1);
      }
    });

    let newPrivateLogs = {};

    Object.entries(cardsTaken).forEach(([myUid, take]) => {
      if (currentPlayers[myUid]?.tryx) {
        let newCard = {...take.card};
        newCard.revealed = false; 
        currentPlayers[myUid].tryx.push(newCard);
        currentPlayers[myUid].tryx = shuffle(currentPlayers[myUid].tryx); 
        // 记录每个人具体抽到了什么牌
        newPrivateLogs[myUid] = `你从 ${currentPlayers[take.fromUid]?.name || '左侧玩家'} 处抽到了【${take.card.role}】！`;
      }
    });

    const catUid = gameState.blackCatTarget;
    if (catUid && currentPlayers[catUid] && !currentPlayers[catUid].isDead) {
      const catPlayer = currentPlayers[catUid];
      const unrevealed = (catPlayer.tryx || []).map((t, i) => ({...t, index: i})).filter(t => !t.revealed);
      if (unrevealed.length > 0) {
        const toReveal = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        catPlayer.tryx[toReveal.index].revealed = true;
        currentLog = addLog(`🐈‍⬛ 黑猫诅咒发作！传染过后，${catPlayer.name} 被迫翻开了一张身份：【${catPlayer.tryx[toReveal.index].role}】`, currentLog);
        
        if (catPlayer.tryx.every(t => t.revealed)) {
          catPlayer.isDead = true;
          currentLog = addLog(`💀 ${catPlayer.name} 因为黑猫的诅咒被全部曝光，悲惨地死去了！`, currentLog);
        }
      }
    }

    currentLog = addLog(`🌪️ 所有人完成了身份交换... 阵营可能已发生惊天逆转。`, currentLog);

    const winner = checkWinCondition(currentPlayers);
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      status: winner ? 'gameover' : 'day',
      players: currentPlayers,
      log: currentLog,
      conspiracyActions: {},
      privateLogs: newPrivateLogs,
      ...(winner ? { winner } : {})
    });
    
    if (!winner) nextTurn(currentLog);
  };


  // --- Gemini AI ---
  const callGemini = async (prompt) => {
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") return { candidates: [{ content: { parts: [{ text: "（请在部署时配置真实的 Gemini API Key 唤醒猎巫人）" }] } }] };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        if (!response.ok) throw new Error();
        return await response.json();
      } catch (err) { if (i === 4) throw err; await new Promise(r => setTimeout(r, [1000,2000,4000,8000,16000][i])); }
    }
  };

  const askWitchHunter = async () => {
    if (!gameState || !gameState.log) return;
    setAiGenerating(true);
    setAiResult('');
    const logText = gameState.log.join('\n');
    const prompt = `你是一个17世纪塞勒姆镇上极度偏执、神经质的资深猎巫人。请仔细分析以下最近的小镇事件日志，用简短、戏剧性且带有一点疯狂的语气（不超过3句话），指出谁最可疑（可能是女巫）或者谁是无辜的。如果信息不足，就发出神经质的警告。\n\n事件日志：\n${logText}`;
    
    try {
      const result = await callGemini(prompt);
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "（猎巫人陷入了疯狂的沉默...）";
      setAiResult(text);
    } catch (err) {
      setAiResult("（猎巫人被黑暗力量屏蔽了，无法回应你的召唤。）");
    }
    setAiGenerating(false);
  };

  const generateGhostMessage = async () => {
    if (ghostMessageUsed || !gameState) return;
    setAiGenerating(true);
    try {
      const res = await callGemini(`你是一个在塞勒姆镇刚刚被残忍杀害的村民幽灵（你的名字是${playerName}）。请用一句简短、阴森且戏剧性的话（中文，不超过20个字），向还活着的玩家发出警告或诡异的诅咒。不要包含系统性提示，直接输出对话。`);
      const txt = res.candidates?.[0]?.content?.parts?.[0]?.text || "（哀嚎）";
      const ref = doc(db, ...getRoomPath(), roomId);
      await updateDoc(ref, { log: addLog(`👻 ${playerName} 的亡魂: "${txt.trim()}"`, gameState.log) });
      setGhostMessageUsed(true);
    } catch {}
    setAiGenerating(false);
  };


  // --- Render Helpers ---
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-red-400 p-8 text-center">
        <Skull className="w-16 h-16 text-red-600 mb-4" />
        <h2 className="text-xl font-bold">{error}</h2>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2 rounded-full font-bold transition"
        >
          <RefreshCw className="w-4 h-4" /> 点击重连
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <Flame className="w-16 h-16 text-red-600 animate-pulse mb-4" />
        <h2 className="text-2xl font-bold tracking-widest text-slate-100 mb-2">猎巫镇</h2>
        <p className="text-slate-500 animate-pulse">正在连接到灵界...</p>
      </div>
    );
  }

  const isMyTurn = gameState?.status === 'day' && gameState?.turnOrder && gameState.turnOrder[gameState.currentTurnIndex] === user?.uid;
  const amIAlive = gameState?.players?.[user?.uid] && !gameState.players[user.uid].isDead;
  const myPlayer = gameState?.players?.[user?.uid];
  
  const isWitch = myPlayer?.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed);
  const isConstable = myPlayer?.tryx?.some(t => t.role === ROLES.CONSTABLE && !t.revealed);

  const getLeftPlayer = () => {
    if (!gameState || !user || !gameState.turnOrder || gameState.turnOrder.length === 0) return null;
    const order = gameState.turnOrder;
    let idx = order.indexOf(user.uid);
    if (idx === -1) return null;
    let leftIdx = idx - 1;
    if (leftIdx < 0) leftIdx = order.length - 1;
    let leftUid = order[leftIdx];
    while (gameState.players[leftUid]?.isDead && leftUid !== user.uid) {
       leftIdx--;
       if (leftIdx < 0) leftIdx = order.length - 1;
       leftUid = order[leftIdx];
    }
    return gameState.players[leftUid];
  };

  const renderWitchChat = () => (
    <div className="bg-slate-950/80 border border-purple-900/50 rounded-xl p-4 flex flex-col h-full relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-900 via-purple-600 to-purple-900 rounded-t-xl opacity-50"></div>
      <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold text-sm">
        <MessageSquare className="w-4 h-4" /> 灵界低语 (仅女巫可见)
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 text-xs pr-2">
        {!gameState.witchChat || gameState.witchChat.length === 0 ? (
          <p className="text-slate-600 italic">在此处密谋你们的暗杀计划...</p>
        ) : (
          gameState.witchChat.map((msg, i) => (
            <div key={i} className="bg-purple-900/20 p-2 rounded border border-purple-900/30">
              <span className="font-bold text-purple-300">{msg.sender}: </span>
              <span className="text-slate-300">{msg.text}</span>
            </div>
          ))
        )}
        <div ref={chatMessagesEndRef} />
      </div>
      <form onSubmit={sendWitchMessage} className="flex gap-2">
        <input 
          type="text" 
          value={witchChatInput}
          onChange={e => setWitchChatInput(e.target.value)}
          placeholder="发送密语..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
          maxLength={50}
        />
        <button type="submit" disabled={!witchChatInput.trim()} className="bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-purple-200 px-4 py-1.5 rounded text-sm font-bold transition">发送</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-red-900/50 p-4 md:p-8 flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Flame className="text-red-500 w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-wider text-slate-100">
            猎巫镇 <span className="text-sm font-normal text-slate-400 ml-2">公网独立部署版</span>
          </h1>
        </div>
        {user && gameState && (
          <div className="text-sm flex items-center gap-4">
            <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hidden sm:inline-block">👤 {playerName}</span>
            {gameState.status === 'lobby' && gameState.players?.[user.uid] && <button onClick={leaveGame} className="text-red-400 hover:text-red-300">退出房间</button>}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          
          {gameState?.status === 'lobby' && (
             <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
              <h2 className="text-2xl font-semibold mb-2">等待玩家集结...</h2>
              <div className="bg-slate-900/80 p-6 rounded-lg border border-slate-600 mb-8 flex flex-col items-center w-full max-w-md shadow-lg shadow-black/50">
                {!gameState.players?.[user?.uid] && (
                  <>
                    <button onClick={() => {
                       const url = new URL(window.location.href); 
                       url.searchParams.set('room', roomId);
                       const t = document.createElement("textarea"); t.value = url.toString(); document.body.appendChild(t); t.select();
                       document.execCommand('copy'); document.body.removeChild(t); alert("完整链接已复制！快发给朋友");
                    }} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-lg font-bold mb-6">
                      复制完整邀请链接 (发给朋友)
                    </button>
                    <div className="w-full">
                      <span className="text-slate-400 text-sm mb-2 block">加入其他房间（输入 6 位房间号 或 粘贴链接）：</span>
                      <div className="flex gap-2">
                        <input type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white" placeholder="例如: A1B2C3" />
                        <button onClick={handleJoinInput} disabled={joinInput.trim()===''} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 rounded">汇合</button>
                      </div>
                    </div>
                  </>
                )}
                {gameState.players?.[user?.uid] && (
                   <div className="text-center">
                     <span className="text-slate-400 text-sm mb-2 block">你们所在的房间号</span>
                     <div className="text-4xl font-black text-amber-500 mb-4 bg-slate-950 px-6 py-3 rounded-lg border-2 border-amber-900/50">{roomId}</div>
                   </div>
                )}
              </div>
              {!gameState.players?.[user?.uid] ? (
                <div className="flex flex-col items-center gap-4">
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-4 py-3 text-center text-lg w-64" placeholder="输入你的昵称" maxLength={10} />
                  <button onClick={joinGame} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-lg font-bold w-64">加入房间</button>
                </div>
              ) : (
                <div className="text-center w-full max-w-md">
                  <p className="text-lg text-emerald-400 mb-6">当前人数：{gameState.turnOrder?.length || 0} / 等待房主开始...</p>
                  <button onClick={startGame} disabled={!gameState.turnOrder || gameState.turnOrder.length < 3} className="bg-red-700 hover:bg-red-600 w-full py-3 rounded-lg font-bold disabled:opacity-50">开始游戏 (至少3人)</button>
                </div>
              )}
            </div>
          )}

          {/* GAME BOARD */}
          {gameState && gameState.status !== 'lobby' && gameState.status !== 'gameover' && (
            <div className="space-y-6">
              
              {/* 新增：最新动态横幅置顶显示在屏幕正中 */}
              {gameState.log && gameState.log.length > 0 && (
                <div className="bg-slate-800/90 border-l-4 border-amber-500 p-4 md:p-6 rounded-r-xl shadow-lg flex items-center gap-4">
                  <Flame className="w-8 h-8 text-amber-500 animate-pulse flex-shrink-0" />
                  <div className="flex-1 text-lg md:text-xl font-bold text-amber-50">
                    {gameState.log[gameState.log.length - 1]}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(gameState.turnOrder || []).map((uid, idx) => {
                  const player = gameState.players[uid];
                  if (!player) return null; 
                  
                  const isMe = uid === user?.uid;
                  const isCurrentTurn = gameState.currentTurnIndex === idx;
                  const targetIsWitch = player.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed);
                  const hasCat = gameState.blackCatTarget === uid;
                  
                  return (
                    <div key={uid} onClick={() => !isMe && !player.isDead && gameState.status === 'day' && setSelectedTarget(uid)}
                      className={`relative bg-slate-800 rounded-lg p-4 border-2 transition-all cursor-pointer ${player.isDead ? 'opacity-50 grayscale border-slate-800' : isCurrentTurn && gameState.status === 'day' ? 'border-amber-500 shadow-lg' : selectedTarget === uid ? 'border-red-500' : 'border-slate-700 hover:border-slate-500'}`}
                    >
                      {player.isDead && <Skull className="absolute inset-0 m-auto w-12 h-12 text-slate-900 opacity-50" />}
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-base flex items-center gap-1">
                          {player.name} {isMe && '(你)'}
                        </h3>
                        <div className="flex gap-1">
                          {hasCat && !player.isDead && <Cat className="w-4 h-4 text-slate-300 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" title="被黑猫诅咒" />}
                          {isWitch && !isMe && targetIsWitch && !player.isDead && <Moon className="w-4 h-4 text-purple-400" title="女巫同伴" />}
                        </div>
                      </div>
                      
                      <div className="text-xs text-amber-500/80 font-bold mb-2 pb-2 border-b border-slate-700">
                        <div>{player.character?.name || '无名之辈'} (阈值: {player.character?.threshold || 7})</div>
                        <div className="text-[10px] text-slate-400 font-normal leading-tight mt-1 bg-slate-900/50 p-1.5 rounded">
                          {player.character?.desc || '暂无技能描述'}
                        </div>
                      </div>
                      
                      <div className="flex gap-1 mb-3">
                        {(player.tryx || []).map((t, i) => (
                          <div key={i} className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-bold border ${t.revealed ? (t.role === ROLES.WITCH ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-blue-900/50 border-blue-500 text-blue-200') : (isMe ? 'bg-slate-800 border-slate-500 text-slate-300' : 'bg-slate-700 border-slate-600 text-slate-500')}`}>
                            {t.revealed ? t.role : (isMe ? <span className="flex items-center gap-1"><Eye className="w-3 h-3"/>{t.role}</span> : '?')}
                          </div>
                        ))}
                      </div>

                      {!player.isDead && (
                        <div className="flex flex-col mt-2 pt-2 border-t border-slate-700 gap-1">
                          <span className="text-xs text-slate-400">指控: {player.accusations || 0} / {player.character?.threshold || 7}</span>
                          <div className="flex gap-1 flex-wrap">
                            {[...Array(player.character?.threshold || 7)].map((_, i) => (
                              <div key={i} className={`w-2 h-2 rounded-full ${i < (player.accusations || 0) ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-slate-700'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* My Action Area */}
              {gameState.status === 'day' && (
                amIAlive ? (
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold">你的手牌</h3>
                        {myPlayer?.character && <span className="bg-amber-900/30 text-amber-500 px-2 py-0.5 rounded text-sm border border-amber-700/50">角色: {myPlayer.character.name}</span>}
                      </div>
                      {isMyTurn && (
                        <div className="flex gap-3">
                          {!gameState.hasPlayedCardThisTurn && (
                            <button onClick={handleDrawCards} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-semibold flex items-center gap-1">摸2张牌</button>
                          )}
                          <button onClick={() => nextTurn()} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold">结束回合</button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {(myPlayer?.hand || []).map(card => (
                        <div key={card.id} onClick={() => isMyTurn && setSelectedCard(card)}
                          className={`min-w-[140px] flex-shrink-0 rounded-lg p-3 border-2 cursor-pointer transition-transform ${selectedCard?.id === card.id ? 'border-amber-400 -translate-y-2' : 'border-slate-600 hover:-translate-y-1'} ${card.type === 'red' ? 'bg-red-950/40' : 'bg-emerald-950/40'}`}
                        >
                          <div className={`text-xs font-bold mb-1 ${card.type === 'red' ? 'text-red-400' : 'text-emerald-400'}`}>{card.type === 'red' ? '进攻牌' : '防御牌'}</div>
                          <div className={`font-bold text-lg mb-2`}>{card.name}</div>
                          <div className="text-xs text-slate-400 leading-tight">{card.desc}</div>
                        </div>
                      ))}
                    </div>

                    {selectedCard && (
                      <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-between">
                        <div>
                          打出 <span className="text-amber-400 font-bold">【{selectedCard.name}】</span> 
                          对目标: {selectedTarget ? <span className="text-red-400 font-bold ml-1">{gameState.players[selectedTarget]?.name}</span> : <span className="text-slate-500 ml-1">请选择目标</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedCard(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
                          <button onClick={playCard} disabled={!selectedTarget} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-6 py-2 rounded font-bold">确定打出</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl p-6 text-center">
                    {gameState.players?.[user?.uid] ? (
                      <>
                        <Skull className="w-12 h-12 text-slate-600 mb-4 mx-auto" />
                        <h3 className="text-xl font-bold text-red-500 mb-2">你已经死了</h3>
                        <button onClick={generateGhostMessage} disabled={aiGenerating || ghostMessageUsed} className="mt-4 bg-purple-900/50 hover:bg-purple-800 text-purple-200 px-6 py-3 rounded-lg font-bold disabled:opacity-50">
                          {aiGenerating ? '通灵中...' : ghostMessageUsed ? '遗言已传达' : '👻 发送 AI 阴森遗言'}
                        </button>
                      </>
                    ) : (
                      <div className="py-6">
                        <Eye className="w-12 h-12 text-slate-600 mb-4 mx-auto" />
                        <h3 className="text-xl font-bold text-slate-300 mb-2">游戏正在激烈进行中</h3>
                        <p className="text-slate-500">你目前是幽灵观战状态，请静候这场对决的结果...</p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Night0 & Night & Conspiracy Overlays */}
          {gameState?.status === 'night0' && (
            <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
              <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl relative">
                <div className="text-center mb-6">
                  <Cat className="w-24 h-24 text-slate-700 absolute -top-4 -right-4" />
                  <h2 className="text-3xl font-bold text-slate-300 mb-2">第0夜：黑猫的诅咒</h2>
                  <p className="text-slate-500">游戏开始前，女巫们正在决定将黑猫放在谁的家门口...</p>
                </div>
                
                {amIAlive && isWitch ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                    <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-900/50 flex flex-col">
                      <h3 className="font-bold text-purple-300 mb-2">女巫决策时刻</h3>
                      {gameState.nightActions?.[user.uid] ? (
                        <div className="flex-1 flex items-center justify-center">
                           <p className="text-emerald-400 font-bold">已确认选择，等待其他女巫...</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-400 mb-4">选择一名玩家放置黑猫。</p>
                          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                            {gameState.turnOrder.map(uid => {
                               if (!gameState.players[uid]) return null;
                               return (
                                 <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-purple-900/50 border border-slate-700 py-2 rounded text-sm truncate px-1">
                                   {gameState.players[uid].name} {uid === user.uid && '(你)'}
                                 </button>
                               );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {renderWitchChat()}
                  </div>
                ) : (
                   <p className="text-slate-400 text-center py-12">
                     {gameState.players?.[user?.uid] ? '平民们在睡梦中等待黎明...' : '你正在观战，小镇已陷入沉睡...'}
                   </p>
                )}
              </div>
            </div>
          )}

          {gameState?.status === 'night' && (
             <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
               <div className="max-w-3xl w-full bg-slate-900 border border-purple-900/50 p-8 rounded-2xl shadow-2xl relative">
                  <div className="text-center mb-6">
                    <Moon className="w-24 h-24 text-purple-600/20 absolute -top-4 -right-4" />
                    <h2 className="text-3xl font-bold text-purple-400 mb-2">黑夜降临</h2>
                    <p className="text-slate-400">暗杀与守护正在进行...</p>
                  </div>

                  {amIAlive ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                      <div className="space-y-4 h-full">
                        {isWitch && (
                          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-900/50 h-full flex flex-col">
                            <h3 className="font-bold text-purple-300 mb-2">女巫暗杀</h3>
                            {gameState.nightActions?.[user.uid] ? (
                              <div className="flex-1 flex items-center justify-center">
                                 <p className="text-emerald-400 font-bold">已确认暗杀目标</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                                {gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead && uid !== user.uid).map(uid => (
                                  <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-red-900/50 border border-slate-700 py-2 rounded text-sm truncate px-1">{gameState.players[uid].name}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {isConstable && (
                          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-900/50 h-full flex flex-col">
                            <h3 className="font-bold text-blue-300 mb-2">治安官守护</h3>
                            {gameState.nightActions?.[user.uid] ? (
                              <div className="flex-1 flex items-center justify-center">
                                <p className="text-emerald-400 font-bold">已确认守护目标</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                                {gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead).map(uid => (
                                  <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-blue-900/50 border border-slate-700 py-2 rounded text-sm truncate px-1">{gameState.players[uid].name}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {!isWitch && !isConstable && (
                           gameState.nightActions?.[user.uid] ? (
                            <div className="flex items-center justify-center h-full"><p className="text-emerald-400 text-center">你在黑暗中屏住了呼吸...</p></div>
                           ) : (
                            <button onClick={() => submitNightAction('none')} className="bg-slate-800 hover:bg-slate-700 text-white w-full h-full rounded-lg font-bold text-xl">闭上眼睛</button>
                           )
                        )}
                      </div>
                      
                      {isWitch && renderWitchChat()}

                    </div>
                  ) : (
                    <p className="text-red-500 text-center py-12">
                      {gameState.players?.[user?.uid] ? '死人是没有夜晚的。' : '你正在观战，小镇已陷入沉睡...'}
                    </p>
                  )}
               </div>
            </div>
          )}

          {gameState?.status === 'conspiracy' && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="max-w-2xl w-full bg-slate-900 border-2 border-amber-600/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(217,119,6,0.2)] text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>
                  <h2 className="text-3xl font-black text-amber-500 mb-2 mt-4 tracking-widest">唯一的一次传染爆发</h2>
                  <p className="text-slate-400 mb-6">每个人必须从自己左侧玩家手中抽走一张未翻开的身份牌！命运即将逆转！</p>

                  {amIAlive ? (
                    gameState.conspiracyActions?.[user.uid] !== undefined ? (
                      <div className="flex flex-col items-center py-12">
                        <UserCheck className="w-16 h-16 text-emerald-500 mb-4" />
                        <p className="text-xl text-emerald-400 font-bold">你已锁定目标</p>
                        <p className="text-slate-500 mt-2">等待其他玩家完成选择...</p>
                      </div>
                    ) : (
                      <div className="bg-slate-800/80 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg text-slate-300 mb-4">
                          你左边的玩家是: <span className="font-bold text-white text-xl ml-2">{getLeftPlayer()?.name}</span>
                        </h3>
                        <p className="text-sm text-amber-500/80 mb-6 font-bold">请点击下方选择你要抽走哪张牌：</p>
                        
                        <div className="flex justify-center gap-4">
                          {(getLeftPlayer()?.tryx || []).map((t, idx) => (
                            <div 
                              key={idx}
                              onClick={() => !t.revealed && submitConspiracyAction(idx)}
                              className={`w-24 h-32 rounded-xl border-4 flex flex-col items-center justify-center transition-all ${
                                t.revealed 
                                  ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                  : 'bg-slate-700 border-slate-500 hover:border-amber-400 hover:-translate-y-2 cursor-pointer shadow-lg'
                              }`}
                            >
                              {t.revealed ? (
                                <span className={`text-sm font-bold ${t.role===ROLES.WITCH?'text-purple-400':'text-blue-400'}`}>{t.role}</span>
                              ) : (
                                <span className="text-4xl text-slate-500">?</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="text-red-500 py-12 text-xl">
                      {gameState.players?.[user?.uid] ? '亡灵只是静静地看着这一切发生...' : '你正在观战，小镇正在发生剧变...'}
                    </p>
                  )}
               </div>
            </div>
          )}

          {/* GAME OVER */}
          {gameState?.status === 'gameover' && (
            <div className="bg-slate-800/80 p-8 rounded-xl border border-yellow-600/50 text-center">
              <h2 className="text-4xl font-bold text-amber-500 mb-4">游戏结束</h2>
              <p className="text-2xl text-white mb-8">{gameState.winner}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left max-w-2xl mx-auto">
                {(gameState.turnOrder || []).map(uid => {
                  const p = gameState.players[uid];
                  if (!p) return null;
                  return (
                    <div key={uid} className="bg-slate-900 p-3 rounded flex justify-between items-center">
                      <span className={p.isDead ? 'line-through text-slate-500' : 'text-slate-200'}>{p.name}</span>
                      <div className="flex gap-1">
                        {(p.tryx || []).map((t, i) => (<span key={i} className={`text-xs px-2 py-1 rounded ${t.role === ROLES.WITCH ? 'bg-purple-900 text-purple-200' : 'bg-slate-700 text-slate-300'}`}>{t.role}</span>))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col h-[500px] lg:h-full overflow-hidden sticky top-4">
            <div className="bg-slate-800 p-3 font-bold border-b border-slate-700 flex items-center justify-between">
              <span>小镇动态</span>
              {gameState?.status === 'day' && <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm flex flex-col-reverse">
              {[...(gameState?.log || [])].reverse().map((msg, i) => (
                <div key={i} className={`pb-2 ${i !== 0 ? 'border-b border-slate-800' : ''} ${msg.includes('💀') ? 'text-red-400' : msg.includes('🐈‍⬛') ? 'text-purple-400 font-bold' : msg.includes('😱') || msg.includes('🌪️') ? 'text-amber-400' : 'text-slate-300'}`}>
                  {msg}
                </div>
              ))}
            </div>
            
            {/* AI Assistant UI */}
            {gameState?.status !== 'lobby' && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/80">
                <button 
                  onClick={askWitchHunter}
                  disabled={aiGenerating}
                  className="w-full bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-700/50 py-2 rounded flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Flame className="w-4 h-4 text-amber-500" />
                  {aiGenerating ? '猎巫人沉思中...' : '猎巫人直觉分析 ✨'}
                </button>
                {aiResult && (
                  <div className="mt-3 p-3 bg-indigo-950/50 rounded border border-indigo-800/30 text-indigo-200 text-xs leading-relaxed italic">
                    "{aiResult}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* 新增：身份窃取结果弹窗 */}
      {showConspiracyResult && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border-2 border-purple-500 p-8 rounded-2xl text-center max-w-sm shadow-[0_0_30px_rgba(168,85,247,0.3)] transform transition-all scale-100">
              <div className="w-16 h-16 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Eye className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-purple-300 mb-4">身份窃取结果</h3>
              <p className="text-lg text-white mb-8">{showConspiracyResult}</p>
              <button 
                onClick={() => setShowConspiracyResult(null)} 
                className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg"
              >
                确认并隐藏
              </button>
           </div>
        </div>
      )}
    </div>
  );
}