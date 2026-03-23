import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { Skull, Shield, Moon, Sun, Scroll, Play, UserPlus, Flame, Search, Globe, Cat, UserCheck, MessageSquare, Eye, RefreshCw, AlertTriangle } from 'lucide-react';

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

// --- 角色系统 (Characters) - 包含部分官方技能实装 ---
const CHARACTERS = [
  { id: 'c1', name: '大力士', desc: '【被动】需要 8 点指控才会受到审判。', threshold: 8 },
  { id: 'c2', name: '部长', desc: '【被动】别人对你打出的“铁证”只算作 1 张指控。', threshold: 7 },
  { id: 'c3', name: '医生', desc: '【主动】你可以将防御牌(绿卡)作为“目击(+7指控)”打出。', threshold: 7 },
  { id: 'c4', name: '镇长', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c5', name: '先知', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c6', name: '铁匠', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c7', name: '农夫', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c8', name: '猎人', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c9', name: '修女', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c10', name: '牧师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c11', name: '裁缝', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c12', name: '乞丐', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c13', name: '厨师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c14', name: '教师', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
  { id: 'c15', name: '守夜人', desc: '默认角色。需要 7 点指控才会受到审判。', threshold: 7 },
];

// --- 牌库配置 ---
const DECK_TEMPLATE = [
  ...Array(25).fill({ type: CARD_TYPES.RED, name: '指控', effect: 1, desc: '目标玩家增加 1 点指控值' }),
  ...Array(7).fill({ type: CARD_TYPES.RED, name: '铁证', effect: 3, desc: '目标玩家增加 3 点指控值' }),
  ...Array(2).fill({ type: CARD_TYPES.RED, name: '目击', effect: 7, desc: '致命一击！直接发起审判' }),
  ...Array(12).fill({ type: CARD_TYPES.GREEN, name: '不在场证明', effect: -1, desc: '目标玩家减少 1 点指控值' }),
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
  const [doctorUseAsWitness, setDoctorUseAsWitness] = useState(false); // 医生技能开关

  // Connection
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || Math.random().toString(36).substring(2, 8).toUpperCase();
  });
  const [joinInput, setJoinInput] = useState(''); 
  const getRoomPath = () => ['salem_rooms'];

  // Witch Chat
  const [witchChatInput, setWitchChatInput] = useState('');
  const chatMessagesEndRef = useRef(null);

  // AI & Popups
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [ghostMessageUsed, setGhostMessageUsed] = useState(false);
  const [showConspiracyResult, setShowConspiracyResult] = useState(null);

  // --- Auth ---
  useEffect(() => {
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
          actionTaken: 'none', // 'none' | 'draw' | 'play' 官方规则：摸牌或出牌二选一
          deck: [],
          discard: [],
          log: ['房间已建立。等待玩家加入...'],
          nightActions: {},
          confessActions: {}, // 自首记录
          conspiracyActions: {},
          privateLogs: {}, 
          winner: null,
          blackCatTarget: null,
          witchChat: [] 
        };
        setGameState(initialData); 
        setDoc(roomRef, initialData).catch(e => setError("数据库写入失败。"));
      }
      setLoading(false);
    }, () => {
      setError("连接服务器失败，请刷新。");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, roomId]);

  useEffect(() => {
    if (gameState?.status === 'night' || gameState?.status === 'night0' || gameState?.status === 'night_confess') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.witchChat, gameState?.status]);

  useEffect(() => {
    if (gameState?.privateLogs && user?.uid && gameState.privateLogs[user.uid]) {
      setShowConspiracyResult(gameState.privateLogs[user.uid]);
    }
  }, [gameState?.privateLogs, user?.uid]);

  const dismissConspiracyPopup = async () => {
    setShowConspiracyResult(null);
    if (user?.uid && roomId) {
      const roomRef = doc(db, ...getRoomPath(), roomId);
      await updateDoc(roomRef, { [`privateLogs.${user.uid}`]: null });
    }
  };

  // --- Lobby Actions ---
  const joinGame = async () => {
    if (!user || !gameState) return;
    if (gameState.status !== 'lobby') return alert("游戏已开始！");
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
        hasBeenWitch: false, // 官方规则：一旦拿过女巫，终身是女巫
      },
      turnOrder: [...(gameState.turnOrder || []), user.uid].filter((v, i, a) => a.indexOf(v) === i),
      log: [...(gameState.log || []), `${playerName} 加入了。`]
    });
  };

  const handleJoinInput = () => {
    const val = joinInput.trim();
    if (!val) return;
    try {
      const url = new URL(val);
      const r = url.searchParams.get('room');
      if (r) setRoomId(r);
    } catch { setRoomId(val.toUpperCase()); }
    setJoinInput('');
  };

  // --- Game Setup (官方配比) ---
  const startGame = async () => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder.length < 3) return alert("至少3人！");
    
    const pCount = gameState.turnOrder.length;
    // 官方 5张身份/人 配置表
    let wCount = pCount >= 6 ? 2 : 1;
    let cCount = 1;
    let pCards = (pCount * 5) - wCount - cCount;

    let tryxPool = shuffle([
      ...Array(wCount).fill({ role: ROLES.WITCH }),
      ...Array(cCount).fill({ role: ROLES.CONSTABLE }),
      ...Array(pCards).fill({ role: ROLES.PEASANT })
    ]);

    let charPool = shuffle([...CHARACTERS]).slice(0, pCount);

    const playersUpdate = { ...(gameState.players || {}) };
    gameState.turnOrder.forEach(uid => {
      if (!playersUpdate[uid]) return;
      playersUpdate[uid].character = charPool.pop();
      // 官方规则：每人发 5 张身份牌
      playersUpdate[uid].tryx = [tryxPool.pop(), tryxPool.pop(), tryxPool.pop(), tryxPool.pop(), tryxPool.pop()].map(t => ({...t, revealed: false, id: Math.random().toString()}));
      playersUpdate[uid].hasBeenWitch = playersUpdate[uid].tryx.some(t => t.role === ROLES.WITCH);
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
      actionTaken: 'none',
      log: ['游戏开始！塞勒姆镇迎来了第0个夜晚... 女巫们正在决定把黑猫放在谁的家门口。'],
      nightActions: {},
      confessActions: {},
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

  // --- Official Rules: Win Condition & Death Check ---
  const checkWinCondition = (currentPlayers) => {
    if (!currentPlayers) return null;
    const alivePlayers = Object.values(currentPlayers).filter(p => p && !p.isDead);
    if(alivePlayers.length === 0) return '平局！小镇毁灭了。';
    
    // 官方规则：如果存活的玩家【都曾是或现在是】女巫，女巫赢。
    if (alivePlayers.every(p => p.hasBeenWitch)) return '邪恶蔓延... 女巫阵营胜利！';
    
    // 官方规则：如果【所有女巫牌】都被翻开了，平民赢。
    const totalWitchCards = Object.values(currentPlayers).reduce((acc, p) => acc + (p.tryx || []).filter(t => t.role === ROLES.WITCH).length, 0);
    const revealedWitchCards = Object.values(currentPlayers).reduce((acc, p) => acc + (p.tryx || []).filter(t => t.role === ROLES.WITCH && t.revealed).length, 0);
    
    if (totalWitchCards > 0 && totalWitchCards === revealedWitchCards) return '女巫被肃清... 平民阵营胜利！';
    
    return null;
  };

  // 官方规则：女巫见光死
  const checkDeath = (targetPlayer, currentLog) => {
    if (targetPlayer.isDead) return currentLog;
    
    const allRevealed = targetPlayer.tryx.every(t => t.revealed);
    const witchRevealed = targetPlayer.tryx.some(t => t.revealed && t.role === ROLES.WITCH);
    
    if (allRevealed || witchRevealed) {
      targetPlayer.isDead = true;
      targetPlayer.tryx.forEach(t => t.revealed = true); // 死亡时展示所有身份
      
      if (witchRevealed) {
        currentLog = addLog(`😱 震惊！被翻开的身份竟然是【女巫】！${targetPlayer.name} 当场被愤怒的村民绞死！`, currentLog);
      } else {
        currentLog = addLog(`💀 ${targetPlayer.name} 的身份已被全部曝光，作为无辜者悲惨地死去了！`, currentLog);
      }
    }
    return currentLog;
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
      actionTaken: 'none', // 重置回合行动
      log: forcedLog ? forcedLog : addLog(`现在是 ${gameState.players[nextUid]?.name || '未知玩家'} 的回合。`, gameState.log),
      ...(winner ? { status: 'gameover', winner } : {})
    });
  };

  // --- Day Actions ---
  const handleDrawCards = async () => {
    if (!gameState || gameState.actionTaken === 'play') return; // 二选一：已出牌则不能摸牌
    
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

    const drawnCards = [drawOne(), drawOne()].filter(c => c);
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
    const updates = { 
      deck: currentDeck, 
      discard: currentDiscard, 
      [`players.${user.uid}.hand`]: myHand,
      actionTaken: 'draw' // 标记已摸牌
    };

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
        currentLog = addLog(`🌪️ 传染爆发！如果场上有黑猫，黑猫持有者将被迫翻开一张牌！`, currentLog);
        updates.log = currentLog;
        await updateDoc(roomRef, updates);
        return;
      }
    } else {
      currentLog = addLog(`${playerName} 抽取了 2 张牌。`, currentLog);
      updates.log = currentLog;
    }

    await updateDoc(roomRef, updates);
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
      
      currentLog = checkDeath(target, currentLog);
    }
    return { updatedTarget: target, updatedLog: currentLog };
  };

  const playCard = async () => {
    if (!selectedCard || !selectedTarget || !gameState || gameState.actionTaken === 'draw') return;
    
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
    
    // 医生技能判定
    let actualEffect = selectedCard.effect;
    let actualName = selectedCard.name;
    if (doctorUseAsWitness && selectedCard.type === CARD_TYPES.GREEN) {
      actualEffect = 7;
      actualName = "目击 (医生技能转换)";
    }
    
    // 部长技能判定
    if (targetPlayer.character?.name === '部长' && selectedCard.name === '铁证') {
      actualEffect = 1;
      currentLog = addLog(`🛡️ 因为是部长，【铁证】对其只产生 1 点指控效果！`, currentLog);
    }

    let logMsg = `${playerName} 对 ${targetPlayer.name} 使用了【${actualName}】。`;

    if (selectedCard.type === CARD_TYPES.RED || doctorUseAsWitness) {
      targetPlayer.accusations = (targetPlayer.accusations || 0) + actualEffect;
      logMsg += ` (${targetPlayer.name} 增加 ${actualEffect} 指控)`;
    } else if (selectedCard.type === CARD_TYPES.GREEN) {
      if (actualEffect === 'transfer') {
        targetPlayer.accusations = (targetPlayer.accusations || 0) + (currentPlayers[user.uid].accusations || 0);
        logMsg += ` (转移了 ${currentPlayers[user.uid].accusations || 0} 点指控)`;
        currentPlayers[user.uid].accusations = 0;
      } else {
        targetPlayer.accusations = (targetPlayer.accusations || 0) + actualEffect;
        if (targetPlayer.accusations < 0) targetPlayer.accusations = 0;
        logMsg += ` (${targetPlayer.name} 指控 ${actualEffect})`;
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
    setDoctorUseAsWitness(false);

    const winner = checkWinCondition(currentPlayers);
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      players: currentPlayers,
      discard: currentDiscard,
      log: currentLog,
      actionTaken: 'play', // 标记为已出牌
      ...(winner ? { status: 'gameover', winner } : {})
    });
  };


  // --- Night Actions & Confession (官方自首规则) ---
  const submitNightAction = async (targetUid) => {
    if (!user) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, { [`nightActions.${user.uid}`]: targetUid || 'none' });
  };

  const submitConfessAction = async (cardIndex) => {
    if (!user) return;
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, { [`confessActions.${user.uid}`]: cardIndex });
  };

  useEffect(() => {
    if (!gameState || !gameState.turnOrder || gameState.turnOrder.length === 0) return;
    const alivePlayers = gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead);
    
    // Night0 (Black Cat)
    if (gameState.status === 'night0' && gameState.turnOrder[0] === user.uid) {
      const witches = gameState.turnOrder.filter(uid => gameState.players[uid]?.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed));
      const allWitchesSubmitted = witches.every(uid => gameState.nightActions && gameState.nightActions[uid]);
      if (allWitchesSubmitted && witches.length > 0) resolveNight0();
      else if (witches.length === 0) resolveNight0(true);
    }
    
    // Night (Assassination & Protect) -> transition to Confess
    if (gameState.status === 'night' && gameState.turnOrder[0] === user.uid) {
      if (alivePlayers.length > 0 && alivePlayers.every(uid => gameState.nightActions && gameState.nightActions[uid])) {
         const roomRef = doc(db, ...getRoomPath(), roomId);
         updateDoc(roomRef, { status: 'night_confess', confessActions: {}, log: addLog(`暗杀已锁定。现在是黎明前的自首时间。`, gameState.log) });
      }
    }

    // Confess Phase -> transition to Day
    if (gameState.status === 'night_confess' && gameState.turnOrder[0] === user.uid) {
      if (alivePlayers.length > 0 && alivePlayers.every(uid => gameState.confessActions && gameState.confessActions[uid] !== undefined)) {
         resolveNightPhase();
      }
    }
    
    // Conspiracy
    if (gameState.status === 'conspiracy' && gameState.turnOrder[0] === user.uid) {
      if (alivePlayers.length > 0 && alivePlayers.every(uid => gameState.conspiracyActions && gameState.conspiracyActions[uid] !== undefined)) resolveConspiracy();
    }
  }, [gameState?.nightActions, gameState?.confessActions, gameState?.conspiracyActions, gameState?.status]);

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
    await updateDoc(roomRef, { status: 'day', log: currentLog, nightActions: {}, confessActions: {}, blackCatTarget: catTarget, witchChat: [] });
  };

  const resolveNightPhase = async () => {
    let currentPlayers = JSON.parse(JSON.stringify(gameState.players));
    let currentLog = [...(gameState.log || [])];
    let witchTargets = {};
    let constableProtected = null;

    // 1. 统计暗杀与守护
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

    currentLog = addLog(`黎明到来...`, currentLog);

    // 2. 结算自首 (Confess)
    if (gameState.confessActions) {
      Object.entries(gameState.confessActions).forEach(([uid, cardIdx]) => {
        if (cardIdx !== 'skip' && currentPlayers[uid]) {
          const target = currentPlayers[uid];
          if (target.tryx && target.tryx[cardIdx] && !target.tryx[cardIdx].revealed) {
            target.tryx[cardIdx].revealed = true;
            currentLog = addLog(`🙋‍♂️ ${target.name} 选择了自首！主动翻开了一张身份：【${target.tryx[cardIdx].role}】`, currentLog);
            currentLog = checkDeath(target, currentLog);
          }
        }
      });
    }

    // 3. 结算暗杀
    if (killTarget && currentPlayers[killTarget] && !currentPlayers[killTarget].isDead) {
      const target = currentPlayers[killTarget];
      const didConfess = gameState.confessActions && gameState.confessActions[killTarget] !== 'skip';
      
      if (killTarget === constableProtected) {
        currentLog = addLog(`昨晚治安官成功保护了受害者，是个平安夜。`, currentLog);
      } else if (didConfess) {
        currentLog = addLog(`🛡️ 昨晚女巫试图暗杀 ${target.name}，但因为他已自首，获得了避难！`, currentLog);
      } else {
        target.isDead = true;
        if (target.tryx) target.tryx.forEach(t => t.revealed = true); 
        currentLog = addLog(`💀 昨晚，女巫无情地暗杀了 ${target.name}！惨死在血泊中。`, currentLog);
      }
    } else {
      currentLog = addLog(`昨晚是个平安夜。`, currentLog);
    }

    const winner = checkWinCondition(currentPlayers);
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, {
      status: winner ? 'gameover' : 'day',
      players: currentPlayers, 
      log: currentLog, 
      nightActions: {}, 
      confessActions: {},
      witchChat: [], 
      ...(winner ? { winner } : {})
    });
    if (!winner) nextTurn(currentLog);
  };

  // --- Conspiracy (Infection) ---
  const submitConspiracyAction = async (cardIndex) => {
    const roomRef = doc(db, ...getRoomPath(), roomId);
    await updateDoc(roomRef, { [`conspiracyActions.${user.uid}`]: cardIndex });
  };

  const resolveConspiracy = async () => {
    let currentPlayers = JSON.parse(JSON.stringify(gameState.players));
    let currentLog = [...(gameState.log || [])];
    const order = gameState.turnOrder || [];
    
    // 官方规则：传染前，黑猫持有者必须先翻开一张牌
    const catUid = gameState.blackCatTarget;
    if (catUid && currentPlayers[catUid] && !currentPlayers[catUid].isDead) {
      const catPlayer = currentPlayers[catUid];
      const unrevealed = (catPlayer.tryx || []).map((t, i) => ({...t, index: i})).filter(t => !t.revealed);
      if (unrevealed.length > 0) {
        const toReveal = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        catPlayer.tryx[toReveal.index].revealed = true;
        currentLog = addLog(`🐈‍⬛ 黑猫诅咒发作！传染前，${catPlayer.name} 被强制翻开了一张身份：【${catPlayer.tryx[toReveal.index].role}】`, currentLog);
        currentLog = checkDeath(catPlayer, currentLog);
      }
    }

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

    // 抹去原位置的牌
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
        
        // 官方规则：一旦获得女巫牌，永久标记为女巫阵营
        if (newCard.role === ROLES.WITCH) currentPlayers[myUid].hasBeenWitch = true;

        newPrivateLogs[myUid] = `你从 ${currentPlayers[take.fromUid]?.name || '左侧玩家'} 处抽到了【${take.card.role}】！`;
      }
    });

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

  // --- AI Witch Hunter ---
  const callGemini = async (prompt) => {
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") return { candidates: [{ content: { parts: [{ text: "（请在部署时配置真实的 Gemini API Key）" }] } }] };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      return await response.json();
    } catch (err) { return {}; }
  };

  const askWitchHunter = async () => {
    if (!gameState || !gameState.log) return;
    setAiGenerating(true); setAiResult('');
    const prompt = `你是一个17世纪塞勒姆镇的资深猎巫人。分析以下日志，用不超过3句话、偏执疯狂的语气指出谁最可疑。\n\n日志：\n${gameState.log.join('\n')}`;
    const result = await callGemini(prompt);
    setAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text || "（猎巫人陷入了疯狂的沉默...）");
    setAiGenerating(false);
  };


  // --- Render Helpers ---
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-red-400 p-8 text-center">
        <Skull className="w-16 h-16 text-red-600 mb-4" />
        <h2 className="text-xl font-bold">{error}</h2>
        <button onClick={() => window.location.reload()} className="mt-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2 rounded-full font-bold transition">
          <RefreshCw className="w-4 h-4" /> 点击重连
        </button>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Flame className="w-16 h-16 text-red-600 animate-pulse" /></div>;

  const isMyTurn = gameState?.status === 'day' && gameState?.turnOrder && gameState.turnOrder[gameState.currentTurnIndex] === user?.uid;
  const amIAlive = gameState?.players?.[user?.uid] && !gameState.players[user.uid].isDead;
  const myPlayer = gameState?.players?.[user?.uid];
  
  const isWitch = myPlayer?.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed);
  const isConstable = myPlayer?.tryx?.some(t => t.role === ROLES.CONSTABLE && !t.revealed);
  const isDoctor = myPlayer?.character?.name === '医生';

  const getLeftPlayer = () => {
    if (!gameState || !user || !gameState.turnOrder) return null;
    let idx = gameState.turnOrder.indexOf(user.uid);
    if (idx === -1) return null;
    let leftIdx = idx - 1 < 0 ? gameState.turnOrder.length - 1 : idx - 1;
    let leftUid = gameState.turnOrder[leftIdx];
    while (gameState.players[leftUid]?.isDead && leftUid !== user.uid) {
       leftIdx = leftIdx - 1 < 0 ? gameState.turnOrder.length - 1 : leftIdx - 1;
       leftUid = gameState.turnOrder[leftIdx];
    }
    return gameState.players[leftUid];
  };

  const renderWitchChat = () => (
    <div className="bg-slate-950/80 border border-purple-900/50 rounded-xl p-4 flex flex-col h-full relative">
      <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold text-sm"><MessageSquare className="w-4 h-4" /> 灵界低语 (仅女巫可见)</div>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 text-xs pr-2">
        {gameState.witchChat?.map((msg, i) => (
          <div key={i} className="bg-purple-900/20 p-2 rounded border border-purple-900/30">
            <span className="font-bold text-purple-300">{msg.sender}: </span><span className="text-slate-300">{msg.text}</span>
          </div>
        ))}
        <div ref={chatMessagesEndRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (witchChatInput.trim()) { const roomRef = doc(db, ...getRoomPath(), roomId); updateDoc(roomRef, { witchChat: arrayUnion({ sender: playerName, text: witchChatInput.trim() }) }); setWitchChatInput(''); } }} className="flex gap-2">
        <input type="text" value={witchChatInput} onChange={e => setWitchChatInput(e.target.value)} placeholder="发送密语..." className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200" />
        <button type="submit" className="bg-purple-900 hover:bg-purple-800 text-purple-200 px-4 py-1.5 rounded text-sm font-bold">发送</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-red-900/50 p-4 md:p-8 flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
        <div className="flex items-center gap-3"><Flame className="text-red-500 w-8 h-8" /><h1 className="text-2xl font-bold tracking-wider text-slate-100">猎巫镇 <span className="text-sm font-normal text-slate-400 ml-2">官方规则完整版</span></h1></div>
        {user && gameState && (
          <div className="text-sm flex items-center gap-4">
            <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hidden sm:inline-block">👤 {playerName} {myPlayer?.hasBeenWitch && <span className="text-purple-500 ml-1" title="你已被感染为女巫阵营">🩸</span>}</span>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          
          {/* LOBBY */}
          {gameState?.status === 'lobby' && (
             <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
              <h2 className="text-2xl font-semibold mb-2">等待玩家集结...</h2>
              <div className="bg-slate-900/80 p-6 rounded-lg border border-slate-600 mb-8 flex flex-col items-center w-full max-w-md shadow-lg shadow-black/50">
                {!gameState.players?.[user?.uid] && (
                  <>
                    <button onClick={() => { const url = new URL(window.location.href); url.searchParams.set('room', roomId); navigator.clipboard.writeText(url.toString()); alert("完整链接已复制！"); }} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-lg font-bold mb-6">复制完整邀请链接</button>
                    <div className="w-full flex gap-2">
                      <input type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white" placeholder="加入其他房间号" />
                      <button onClick={handleJoinInput} className="bg-slate-700 px-4 py-2 rounded">汇合</button>
                    </div>
                  </>
                )}
                {gameState.players?.[user?.uid] && <div className="text-center"><span className="text-slate-400 text-sm mb-2 block">你们所在的房间号</span><div className="text-4xl font-black text-amber-500 mb-4 bg-slate-950 px-6 py-3 rounded-lg border-2 border-amber-900/50">{roomId}</div></div>}
              </div>
              {!gameState.players?.[user?.uid] ? (
                <div className="flex flex-col items-center gap-4">
                  <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-4 py-3 text-center text-lg w-64" placeholder="输入昵称" maxLength={10} />
                  <button onClick={joinGame} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-lg font-bold w-64">加入房间</button>
                </div>
              ) : (
                <div className="text-center w-full max-w-md">
                  <p className="text-lg text-emerald-400 mb-6">当前人数：{gameState.turnOrder?.length || 0} (推荐4-12人)</p>
                  <button onClick={startGame} disabled={!gameState.turnOrder || gameState.turnOrder.length < 3} className="bg-red-700 hover:bg-red-600 w-full py-3 rounded-lg font-bold disabled:opacity-50">开始游戏</button>
                </div>
              )}
            </div>
          )}

          {/* GAME BOARD */}
          {gameState && gameState.status !== 'lobby' && gameState.status !== 'gameover' && (
            <div className="space-y-6">
              {gameState.log && gameState.log.length > 0 && (
                <div className="bg-slate-800/90 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-lg flex items-center gap-4">
                  <Flame className="w-8 h-8 text-amber-500 animate-pulse flex-shrink-0" />
                  <div className="flex-1 text-lg font-bold text-amber-50">{gameState.log[gameState.log.length - 1]}</div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(gameState.turnOrder || []).map((uid, idx) => {
                  const player = gameState.players[uid];
                  if (!player) return null; 
                  const isMe = uid === user?.uid;
                  const isCurrentTurn = gameState.currentTurnIndex === idx;
                  const targetIsWitch = player.tryx?.some(t => t.role === ROLES.WITCH && !t.revealed);
                  
                  return (
                    <div key={uid} onClick={() => !isMe && !player.isDead && gameState.status === 'day' && setSelectedTarget(uid)} className={`relative bg-slate-800 rounded-lg p-3 border-2 transition-all cursor-pointer ${player.isDead ? 'opacity-50 grayscale border-slate-800' : isCurrentTurn && gameState.status === 'day' ? 'border-amber-500 shadow-lg' : selectedTarget === uid ? 'border-red-500' : 'border-slate-700 hover:border-slate-500'}`}>
                      {player.isDead && <Skull className="absolute inset-0 m-auto w-12 h-12 text-slate-900 opacity-50" />}
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-sm flex items-center gap-1">{player.name} {isMe && '(你)'}</h3>
                        <div className="flex gap-1">
                          {gameState.blackCatTarget === uid && !player.isDead && <Cat className="w-4 h-4 text-slate-300" />}
                          {isWitch && !isMe && targetIsWitch && !player.isDead && <Moon className="w-4 h-4 text-purple-400" />}
                        </div>
                      </div>
                      
                      <div className="text-xs text-amber-500/80 font-bold mb-2 pb-1 border-b border-slate-700">
                        <div>{player.character?.name || '平民'} (阈值: {player.character?.threshold || 7})</div>
                        <div className="text-[10px] text-slate-400 font-normal leading-tight mt-1 bg-slate-900/50 p-1 rounded line-clamp-2">{player.character?.desc}</div>
                      </div>
                      
                      {/* 5张身份牌展示 */}
                      <div className="flex gap-1 mb-2">
                        {(player.tryx || []).map((t, i) => (
                          <div key={i} className={`flex-1 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${t.revealed ? (t.role === ROLES.WITCH ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-blue-900/50 border-blue-500 text-blue-200') : (isMe ? 'bg-slate-800 border-slate-500 text-slate-300' : 'bg-slate-700 border-slate-600 text-slate-500')}`}>
                            {t.revealed ? t.role[0] : (isMe ? <span className="flex items-center gap-0.5"><Eye className="w-2 h-2"/>{t.role[0]}</span> : '?')}
                          </div>
                        ))}
                      </div>

                      {!player.isDead && (
                        <div className="flex flex-col mt-2 pt-1 border-t border-slate-700 gap-1">
                          <span className="text-[10px] text-slate-400">指控: {player.accusations || 0} / {player.character?.threshold || 7}</span>
                          <div className="flex gap-0.5 flex-wrap">
                            {[...Array(player.character?.threshold || 7)].map((_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (player.accusations || 0) ? 'bg-red-500' : 'bg-slate-700'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* My Action Area */}
              {gameState.status === 'day' && amIAlive && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">你的手牌</h3>
                    {isMyTurn && (
                      <div className="flex gap-3">
                        {/* 官方规则：只能二选一 */}
                        <button onClick={handleDrawCards} disabled={gameState.actionTaken === 'play'} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:grayscale px-4 py-2 rounded font-semibold">摸 2 张牌</button>
                        <button onClick={() => nextTurn()} disabled={gameState.actionTaken === 'none'} className="bg-slate-700 hover:bg-amber-600 disabled:opacity-30 px-4 py-2 rounded font-semibold text-white">结束回合</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {(myPlayer?.hand || []).map(card => (
                      <div key={card.id} onClick={() => isMyTurn && gameState.actionTaken !== 'draw' && setSelectedCard(card)}
                        className={`min-w-[120px] flex-shrink-0 rounded-lg p-3 border-2 cursor-pointer transition-transform ${selectedCard?.id === card.id ? 'border-amber-400 -translate-y-2' : gameState.actionTaken === 'draw' ? 'border-slate-800 opacity-50 cursor-not-allowed' : 'border-slate-600 hover:-translate-y-1'} ${card.type === 'red' ? 'bg-red-950/40' : 'bg-emerald-950/40'}`}
                      >
                        <div className={`text-xs font-bold mb-1 ${card.type === 'red' ? 'text-red-400' : 'text-emerald-400'}`}>{card.type === 'red' ? '进攻牌' : '防御牌'}</div>
                        <div className={`font-bold text-base mb-1`}>{card.name}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">{card.desc}</div>
                      </div>
                    ))}
                  </div>

                  {selectedCard && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div>
                        准备打出 <span className="text-amber-400 font-bold">【{selectedCard.name}】</span> 对目标: {selectedTarget ? <span className="text-red-400 font-bold ml-1">{gameState.players[selectedTarget]?.name}</span> : <span className="text-slate-500 ml-1">请点击上方选择目标玩家</span>}
                      </div>
                      <div className="flex gap-2 items-center">
                        {/* 医生特殊技能按钮 */}
                        {isDoctor && selectedCard.type === CARD_TYPES.GREEN && (
                          <label className="flex items-center gap-2 text-sm text-amber-300 mr-4 cursor-pointer">
                            <input type="checkbox" checked={doctorUseAsWitness} onChange={(e) => setDoctorUseAsWitness(e.target.checked)} className="rounded text-amber-500" />
                            作为"目击(+7)"打出 (医生技能)
                          </label>
                        )}
                        <button onClick={() => {setSelectedCard(null); setDoctorUseAsWitness(false);}} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
                        <button onClick={playCard} disabled={!selectedTarget} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-6 py-2 rounded font-bold">确定打出</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Overlays: Night0, Night, Night_Confess, Conspiracy */}
          {/* Night0: Black Cat */}
          {gameState?.status === 'night0' && (
            <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
              <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 p-8 rounded-2xl text-center relative">
                <Cat className="w-16 h-16 text-slate-700 absolute -top-4 -right-4" />
                <h2 className="text-3xl font-bold text-slate-300 mb-2">第0夜：放置黑猫</h2>
                {amIAlive && isWitch ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64 mt-6">
                    <div className="bg-purple-900/20 p-4 rounded-lg flex flex-col border border-purple-900/50">
                      <h3 className="font-bold text-purple-300 mb-4">选择目标</h3>
                      {gameState.nightActions?.[user.uid] ? (
                        <div className="flex-1 flex items-center justify-center"><p className="text-emerald-400">已确认...</p></div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                          {gameState.turnOrder.map(uid => <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-purple-900/50 py-2 rounded text-sm">{gameState.players[uid]?.name}</button>)}
                        </div>
                      )}
                    </div>
                    {renderWitchChat()}
                  </div>
                ) : <p className="text-slate-500 py-12 mt-6">平民们在睡梦中等待黎明...</p>}
              </div>
            </div>
          )}

          {/* Night: Assasination & Protect */}
          {gameState?.status === 'night' && (
             <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
               <div className="max-w-3xl w-full bg-slate-900 border border-purple-900/50 p-8 rounded-2xl relative">
                  <h2 className="text-3xl font-bold text-purple-400 mb-2 text-center">黑夜降临：暗杀时刻</h2>
                  {amIAlive ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64 mt-6">
                      <div className="space-y-4 h-full">
                        {isWitch && (
                          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-900/50 h-full flex flex-col">
                            <h3 className="font-bold text-purple-300 mb-2">女巫暗杀</h3>
                            {gameState.nightActions?.[user.uid] ? <p className="text-emerald-400 text-center mt-8">已确认</p> : (
                              <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                                {gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead && uid !== user.uid).map(uid => <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-red-900/50 py-2 rounded text-sm">{gameState.players[uid].name}</button>)}
                              </div>
                            )}
                          </div>
                        )}
                        {isConstable && (
                          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-900/50 h-full flex flex-col">
                            <h3 className="font-bold text-blue-300 mb-2">治安官守护</h3>
                            {gameState.nightActions?.[user.uid] ? <p className="text-emerald-400 text-center mt-8">已确认</p> : (
                              <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
                                {gameState.turnOrder.filter(uid => !gameState.players[uid]?.isDead).map(uid => <button key={uid} onClick={() => submitNightAction(uid)} className="bg-slate-800 hover:bg-blue-900/50 py-2 rounded text-sm">{gameState.players[uid].name}</button>)}
                              </div>
                            )}
                          </div>
                        )}
                        {!isWitch && !isConstable && (
                           gameState.nightActions?.[user.uid] ? <div className="flex items-center justify-center h-full"><p className="text-emerald-400 text-center">你在黑暗中屏住了呼吸...</p></div> : <button onClick={() => submitNightAction('none')} className="bg-slate-800 hover:bg-slate-700 text-white w-full h-full rounded-lg font-bold text-xl">闭上眼睛</button>
                        )}
                      </div>
                      {isWitch && renderWitchChat()}
                    </div>
                  ) : <p className="text-red-500 text-center py-12">死人是没有夜晚的。</p>}
               </div>
            </div>
          )}

          {/* NEW Phase: Night Confession */}
          {gameState?.status === 'night_confess' && (
             <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="max-w-2xl w-full bg-slate-900 border-2 border-indigo-500/50 p-8 rounded-2xl text-center relative">
                  <Shield className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-indigo-300 mb-2">黎明前的审判：自首环节</h2>
                  <p className="text-slate-400 mb-8">主动翻开一张身份牌，如果不是女巫，你今晚将获得绝对庇护（免受女巫暗杀）。但如果翻到女巫牌，你会立刻自尽！</p>

                  {amIAlive ? (
                    gameState.confessActions?.[user.uid] !== undefined ? (
                      <div className="py-8"><p className="text-xl text-emerald-400 font-bold">已决定，等待天亮...</p></div>
                    ) : (
                      <div>
                        <div className="flex justify-center gap-2 mb-8">
                          {(myPlayer?.tryx || []).map((t, idx) => (
                            <button 
                              key={idx} onClick={() => submitConfessAction(idx)} disabled={t.revealed}
                              className={`w-20 h-28 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${t.revealed ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 border-slate-500 hover:border-indigo-400 hover:-translate-y-2'}`}
                            >
                              {t.revealed ? <span className="text-sm font-bold text-slate-500">{t.role[0]}</span> : <span className="text-indigo-300 text-xs">翻开这张<br/>以求庇护</span>}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => submitConfessAction('skip')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-8 py-3 rounded-full font-bold w-full max-w-xs transition-colors">放弃自首，听天由命</button>
                      </div>
                    )
                  ) : <p className="text-red-500 py-12 text-xl">亡灵静静注视着小镇...</p>}
               </div>
            </div>
          )}

          {/* Conspiracy (Infection) */}
          {gameState?.status === 'conspiracy' && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="max-w-2xl w-full bg-slate-900 border-2 border-amber-600/50 p-6 rounded-2xl text-center relative">
                  <h2 className="text-3xl font-black text-amber-500 mb-2 mt-4">传染爆发</h2>
                  <p className="text-slate-400 mb-6">每个人必须从自己左侧玩家手中抽走一张未翻开的身份牌！</p>
                  {amIAlive ? (
                    gameState.conspiracyActions?.[user.uid] !== undefined ? (
                      <div className="py-12"><p className="text-xl text-emerald-400 font-bold">你已锁定目标</p></div>
                    ) : (
                      <div className="bg-slate-800/80 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg text-slate-300 mb-4">左侧玩家: <span className="font-bold text-white text-xl ml-2">{getLeftPlayer()?.name}</span></h3>
                        <div className="flex justify-center gap-2">
                          {(getLeftPlayer()?.tryx || []).map((t, idx) => (
                            <button key={idx} onClick={() => !t.revealed && submitConspiracyAction(idx)} className={`w-16 h-24 rounded-lg border-2 flex items-center justify-center transition-all ${t.revealed ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 border-slate-500 hover:border-amber-400 hover:-translate-y-2'}`}>
                              {t.revealed ? <span className="text-xs">{t.role[0]}</span> : <span className="text-2xl text-slate-500">?</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  ) : <p className="text-red-500 py-12 text-xl">亡灵观战中...</p>}
               </div>
            </div>
          )}

          {/* GAME OVER */}
          {gameState?.status === 'gameover' && (
            <div className="bg-slate-800/80 p-8 rounded-xl border border-yellow-600/50 text-center">
              <h2 className="text-4xl font-bold text-amber-500 mb-4">游戏结束</h2>
              <p className="text-2xl text-white mb-8">{gameState.winner}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                {(gameState.turnOrder || []).map(uid => {
                  const p = gameState.players[uid];
                  if (!p) return null;
                  return (
                    <div key={uid} className={`bg-slate-900 p-3 rounded flex justify-between items-center border-l-4 ${p.hasBeenWitch ? 'border-purple-600' : 'border-blue-600'}`}>
                      <div>
                        <span className={p.isDead ? 'line-through text-slate-500' : 'text-slate-200'}>{p.name}</span>
                        {p.hasBeenWitch && <span className="text-xs text-purple-400 ml-2">曾感染</span>}
                      </div>
                      <div className="flex gap-0.5">
                        {(p.tryx || []).map((t, i) => (<span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${t.role === ROLES.WITCH ? 'bg-purple-900 text-purple-200' : 'bg-slate-700 text-slate-300'}`}>{t.role[0]}</span>))}
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
            <div className="bg-slate-800 p-3 font-bold border-b border-slate-700">小镇动态</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm flex flex-col-reverse">
              {[...(gameState?.log || [])].reverse().map((msg, i) => (
                <div key={i} className={`pb-2 ${i !== 0 ? 'border-b border-slate-800' : ''} ${msg.includes('💀') ? 'text-red-400' : msg.includes('🙋‍♂️') || msg.includes('🛡️') ? 'text-indigo-300' : msg.includes('😱') || msg.includes('🌪️') ? 'text-amber-400' : 'text-slate-300'}`}>
                  {msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 身份窃取结果弹窗 */}
      {showConspiracyResult && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border-2 border-purple-500 p-8 rounded-2xl text-center max-w-sm">
              <Eye className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-purple-300 mb-4">身份窃取结果</h3>
              <p className="text-lg text-white mb-8">{showConspiracyResult}</p>
              <button onClick={dismissConspiracyPopup} className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold">确认并隐藏</button>
           </div>
        </div>
      )}
    </div>
  );
}