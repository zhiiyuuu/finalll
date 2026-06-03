let video;
let handpose;
let predictions = [];

// 玩家手部位置 (第一關仍保留手勢，第二關全面改用滑鼠)
let handX = 0;
let handY = 0;
let isModelReady = false;

// 遊戲狀態
let gameState = 'START_MENU'; 

// --- 第一關：水果相關變數 ---
let totalFruitsCaught = 0; 
let fruitX, fruitY;
let fruitSpeed = 3;
let currentFruitType = {};
let fruitsPool = [
  { id: 0, nameEN: 'Apple', nameCH: '蘋果', emoji: '🍎', color: [230, 50, 50] },
  { id: 1, nameEN: 'Banana', nameCH: '香蕉', emoji: '🍌', color: [240, 200, 20] },
  { id: 2, nameEN: 'Watermelon', nameCH: '西瓜', emoji: '🍉', color: [50, 180, 50] },
  { id: 3, nameEN: 'Strawberry', nameCH: '草莓', emoji: '🍓', color: [255, 65, 105] },
  { id: 4, nameEN: 'Cherry', nameCH: '櫻桃', emoji: '🍒', color: [200, 20, 40] }
];
let caughtFruitsSet = { 0: false, 1: false, 2: false, 3: false, 4: false };
let displayWordEN = "", displayWordCH = "", displayEmoji = "";
let textTimer = 0;

// --- 第二關：電流急急棒相關變數 (純滑鼠 + 水果指標) ---
let mazePath = []; 
let startZone = { x: 60, y: 380, r: 35 }; 
let endZone = { x: 580, y: 120, r: 35 };  
let isPlayerActive = false; 
let isZap = false; 
let zapTimer = 0;
let mazeFruitEmoji = '🍎'; // 第二關玩家的滑鼠水果外觀

function setup() {
  createCanvas(640, 480);
  
  // 初始化攝影機
  initCamera();

  // 生成第一關第一個水果
  spawnFruit();

  // 初始化第二關軌道頂點位置
  mazePath = [
    { x: 60, y: 380 },
    { x: 200, y: 380 },
    { x: 200, y: 250 },
    { x: 450, y: 250 },
    { x: 450, y: 120 },
    { x: 580, y: 120 }
  ];
}

// 建立/初始化攝影機的獨立函式
function initCamera() {
  if (!video) {
    video = createCapture(VIDEO);
    video.size(640, 480); 
    video.hide(); 
    
    try {
      handpose = ml5.handpose(video, modelReady);
      handpose.on("predict", results => {
        predictions = results;
      });
    } catch (e) {
      console.error("ml5 載入失敗:", e);
    }
  } else {
    // 如果鏡頭本來就存在，只是之前被關閉了，就把它重新打開
    video.start();
  }
}

function modelReady() {
  console.log("Handpose 模型載入成功！");
  isModelReady = true;
}

function draw() {
  background(227, 242, 253); 
  
  // 1. 第一關相關畫面繪製攝影機視訊
  if (video && gameState !== 'PLAY_STAGE2' && gameState !== 'STAGE2_CLEAR') {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height); 
    pop();
  } else {
    // 第二關背景改為深色迷宮氛圍
    background(30, 35, 45);
  }
  
  // 2. 核心遊戲流程控制
  switch (gameState) {
    case 'START_MENU':
      cursor(); 
      drawStartMenu();
      break;
    case 'PLAY_STAGE1':
      cursor(); 
      runFirstStage();
      break;
    case 'STAGE1_CLEAR':
      cursor(); 
      drawStage1ClearScreen();
      break;
    case 'START_STAGE2':
      cursor(); 
      drawStartStage2();
      break;
    case 'PLAY_STAGE2':
      noCursor(); // 隱藏系統滑鼠，用自訂水果代替
      runSecondStage();
      break;
    case 'STAGE2_CLEAR':
      cursor(); // 恢復系統滑鼠
      drawStage2ClearScreen();
      break;
  }

  // 3. 只有在第一關相關畫面時顯示手部骨架
  if (gameState === 'START_MENU' || gameState === 'PLAY_STAGE1' || gameState === 'STAGE1_CLEAR') {
    drawHandSkeleton();
  }
}

function mousePressed() {
  if (gameState === 'START_MENU') {
    // 開始遊戲按鈕：放寬感應範圍
    if (mouseX > width/2 - 120 && mouseX < width/2 + 120 && mouseY > height/2 + 120 - 35 && mouseY < height/2 + 120 + 35) {
      gameState = 'PLAY_STAGE1';
    }
  } else if (gameState === 'STAGE1_CLEAR') {
    // 進入第二關按鈕：放寬感應範圍
    if (mouseX > width/2 - 130 && mouseX < width/2 + 130 && mouseY > height/2 + 40 - 35 && mouseY < height/2 + 40 + 35) {
      if (video) video.stop(); 
      gameState = 'START_STAGE2';
    }
  } else if (gameState === 'START_STAGE2') {
    // 開始挑戰按鈕：放寬感應範圍
    if (mouseX > width/2 - 120 && mouseX < width/2 + 120 && mouseY > height/2 + 100 - 35 && mouseY < height/2 + 100 + 35) {
      gameState = 'PLAY_STAGE2';
      isPlayerActive = false; 
      mazeFruitEmoji = random(fruitsPool).emoji; 
    }
  } else if (gameState === 'STAGE2_CLEAR') {
    // 大通關「再玩一次」按鈕：大幅擴大感應範圍！確保絕對能點到
    if (mouseX > width/2 - 150 && mouseX < width/2 + 150 && mouseY > height/2 + 50 - 45 && mouseY < height/2 + 50 + 45) {
      resetWholeGame();
    }
  }
}

// 完全重置遊戲數據的函式
function resetWholeGame() {
  totalFruitsCaught = 0;
  caughtFruitsSet = { 0: false, 1: false, 2: false, 3: false, 4: false };
  displayWordEN = ""; displayWordCH = ""; displayEmoji = "";
  textTimer = 0;
  isPlayerActive = false;
  isZap = false;
  
  // 重新啟動鏡頭
  initCamera();
  spawnFruit();
  
  // 直接切換回第一關開始畫面選單狀態
  gameState = 'START_MENU';
}

// ==========================================
// 🔴 第一關 核心邏輯
// ==========================================
function drawStartMenu() {
  // 黑色半透明底罩
  fill(0, 0, 0, 160); noStroke(); rect(0, 0, width, height);
  
  // ✨ 最上方的可愛粗粗字體提示語
  push();
  fill(255, 182, 193); // 粉嫩可愛的粉紅色
  textAlign(CENTER, TOP);
  // 使用微軟正黑體/圓體，並強制設定為粗體 BOLD
  textFont('Microsoft JhengHei, YuGothic, sans-serif');
  textStyle(BOLD); 
  textSize(16);
  text("第一關請等畫面顯示「鏡頭已就緒」再開始遊戲 謝謝<3", width / 2, 25);
  pop();

  textAlign(CENTER, CENTER);
  fill(255); textSize(24); text("🟢 第一關：水果碰碰樂學英文", width / 2, height / 2 - 50);
  textSize(14); fill(220); text("請伸出手指，用食指指尖（紅色點）碰撞掉落的水果！", width / 2, height / 2);
  fill(255, 235, 59); text("💡 通關條件：必須將 5 種不同的水果各接過一次才可以過關！", width / 2, height / 2 + 25);

  if (isModelReady) { fill(100, 255, 100); text("✅ AI 鏡頭已就緒，隨時可以開始！", width / 2, height / 2 + 65); }
  else { fill(255, 150, 150); text("⏳ AI 影像模型載入中，請稍候...", width / 2, height / 2 + 65); }

  rectMode(CENTER); fill(255, 105, 180); stroke(255); strokeWeight(2);
  rect(width / 2, height / 2 + 120, 180, 50, 10);
  noStroke(); fill(255); textSize(22); text("開始遊戲", width / 2, height / 2 + 120);
}

function runFirstStage() {
  fruitY += fruitSpeed;
  textSize(45); textAlign(CENTER, CENTER); text(currentFruitType.emoji, fruitX, fruitY);
  if (fruitY > height) spawnFruit();

  if (updateIndexFingerPosition()) {
    let d = dist(handX, handY, fruitX, fruitY);
    if (d < 45) { 
      totalFruitsCaught += 1; 
      caughtFruitsSet[currentFruitType.id] = true;
      displayWordEN = currentFruitType.nameEN;
      displayWordCH = currentFruitType.nameCH;
      displayEmoji = currentFruitType.emoji;
      textTimer = 90;
      spawnFruit();
      
      let allFiveCaught = caughtFruitsSet[0] && caughtFruitsSet[1] && caughtFruitsSet[2] && caughtFruitsSet[3] && caughtFruitsSet[4];
      if (allFiveCaught) gameState = 'STAGE1_CLEAR';
    }
  }
  if (textTimer > 0) { drawWordCard(); textTimer--; }
  drawUI();
}

function spawnFruit() {
  fruitX = random(50, width - 50); fruitY = -50;
  fruitSpeed = random(3, 6); currentFruitType = random(fruitsPool);
}

function drawWordCard() {
  push(); rectMode(CENTER); fill(255, 255, 255, 230); stroke(currentFruitType.color); strokeWeight(5);
  rect(width / 2, height / 2 - 20, 300, 160, 15);
  noStroke(); fill(50); textSize(32); text(displayWordEN, width / 2, height / 2 - 40);
  textSize(24); text(displayWordCH + " " + displayEmoji, width / 2, height / 2 + 20); pop();
}

function drawUI() {
  fill(0, 0, 0, 140); noStroke(); rect(0, 0, width, 65);
  textAlign(LEFT, CENTER); fill(255); textSize(16); text("🟢 第一關：水果碰碰樂學英文", 20, 22);
  textSize(12); fill(230);
  let appleStatus = caughtFruitsSet[0] ? "✅🍎" : "❌🍎";
  let bananaStatus = caughtFruitsSet[1] ? "✅🍌" : "❌🍌";
  let melonStatus = caughtFruitsSet[2] ? "✅🍉" : "❌🍉";
  let strawberryStatus = caughtFruitsSet[3] ? "✅🍓" : "❌🍓";
  let cherryStatus = caughtFruitsSet[4] ? "✅🍒" : "❌🍒";
  text("圖鑑進度: " + appleStatus + " " + bananaStatus + " " + melonStatus + " " + strawberryStatus + " " + cherryStatus, 20, 48);
  
  textAlign(RIGHT, CENTER); textSize(15); fill(255);
  let count = 0; for(let i=0; i<5; i++) { if(caughtFruitsSet[i]) count++; }
  text("已集滿種類: " + count + " / 5", width - 20, 32);
}

function drawStage1ClearScreen() {
  fill(0, 220); rect(0, 0, width, height);
  textAlign(CENTER, CENTER); fill(255, 215, 0); textSize(42); text("通關成功！", width / 2, height / 2 - 40); 
  rectMode(CENTER); fill(255, 105, 180); stroke(255); strokeWeight(2);
  rect(width / 2, height / 2 + 40, 220, 50, 10);
  noStroke(); fill(255); textSize(18); text("進入第二關", width / 2, height / 2 + 40);
}

// ==========================================
// ⚡ 第二關 核心邏輯
// ==========================================
function drawStartStage2() {
  fill(25, 30, 40); noStroke(); rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  fill(255); textSize(24); text("⚡ 第二關：英文單字電流急急棒", width / 2, height / 2 - 50);
  
  textSize(14); fill(210); text("請移動【滑鼠游標】（它會變成一顆水果糖喔！）從藍色【START】出發，", width / 2, height / 2 - 5);
  text("沿著單字能量軌道前進，安全抵達綠色【GOAL】終點！", width / 2, height / 2 + 20);
  fill(255, 100, 100); text("⚠️ 注意：水果一旦移出軌道外，就會觸電回到起點重來！", width / 2, height / 2 + 50);

  rectMode(CENTER); fill(255, 105, 180); stroke(255); strokeWeight(2);
  rect(width / 2, height / 2 + 110, 180, 50, 10);
  noStroke(); fill(255); textSize(22); text("開始挑戰", width / 2, height / 2 + 110);
}

function runSecondStage() {
  // 1. 繪製急急棒軌道 
  strokeWeight(35); 
  stroke(255, 255, 255, 40); 
  noFill();
  beginShape();
  for (let p of mazePath) { vertex(p.x, p.y); }
  endShape();

  // 走道上的英文
  push();
  noStroke(); fill(100, 149, 237); textSize(13); textAlign(CENTER, CENTER); textStyle(BOLD);
  text("APPLE 🍎", 130, 380); 
  text("BANANA 🍌", 200, 310); 
  text("WATERMELON 🍉", 325, 250); 
  text("STRAWBERRY 🍓", 450, 180); 
  text("CHERRY 🍒", 525, 120);
  pop();

  // 2. 畫出起點與終點圈圈
  noStroke();
  fill(0, 150, 255, 180); 
  ellipse(startZone.x, startZone.y, startZone.r * 2);
  fill(255); textSize(11); textAlign(CENTER, CENTER); text("START", startZone.x, startZone.y);

  fill(0, 230, 100, 180); 
  ellipse(endZone.x, endZone.y, endZone.r * 2);
  fill(255); text("GOAL", endZone.x, endZone.y);

  // 3. 滑鼠碰撞檢測
  if (!isZap) {
    if (!isPlayerActive) {
      let dStart = dist(mouseX, mouseY, startZone.x, startZone.y);
      if (dStart < startZone.r) { isPlayerActive = true; }
    } else {
      let onPath = checkPointOnPath(mouseX, mouseY, 25); 
      if (!onPath) {
        isZap = true;
        zapTimer = 20; 
        isPlayerActive = false; 
      }
      
      let dGoal = dist(mouseX, mouseY, endZone.x, endZone.y);
      if (dGoal < endZone.r) { gameState = 'STAGE2_CLEAR'; }
    }
  }

  // 4. 觸電紅光視覺特效
  if (isZap) {
    fill(255, 0, 0, 150); noStroke(); rect(0, 0, width, height);
    fill(255); textSize(30); textAlign(CENTER, CENTER); text("⚡ OUT! 觸電了 ⚡", width/2, height/2);
    zapTimer--;
    if (zapTimer <= 0) isZap = false;
  }

  // 5. 繪製跟隨滑鼠移動的水果游標
  if (!isZap) {
    textSize(35);
    textAlign(CENTER, CENTER);
    text(mazeFruitEmoji, mouseX, mouseY);
  }

  drawStage2UI();
}

function drawStage2UI() {
  fill(20, 25, 35, 200); noStroke(); rect(0, 0, width, 50);
  textAlign(LEFT, CENTER); fill(255); textSize(16);
  text("⚡ 第二關：英文單字電流急急棒", 20, 25);
  
  textAlign(RIGHT, CENTER);
  if (isPlayerActive) {
    fill(100, 255, 100); text("運作中：請帶領水果沿著通道前進！", width - 20, 25);
  } else {
    fill(255, 180, 0); text("請先將【水果滑鼠】移到藍色 START 起點", width - 20, 25);
  }
}

// 大通關畫面：極簡風格 + 粉紅色「再玩一次」按鈕
function drawStage2ClearScreen() {
  fill(20, 25, 35); rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  fill(255, 215, 0); textSize(46); 
  text("全部通關成功！", width / 2, height / 2 - 40); 
  
  // 粉紅色再玩一次按鈕
  rectMode(CENTER); fill(255, 105, 180); stroke(255); strokeWeight(2);
  rect(width / 2, height / 2 + 50, 180, 50, 10);
  
  noStroke(); fill(255); textSize(20);
  text("再玩一次", width / 2, height / 2 + 50);
}

// 檢查點是否在多段折線軌道上
function checkPointOnPath(px, py, maxDist) {
  for (let i = 0; i < mazePath.length - 1; i++) {
    let p1 = mazePath[i]; let p2 = mazePath[i+1];
    let d = distToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
    if (d < maxDist) return true;
  }
  return false;
}
function distToSegment(px, py, x1, y1, x2, y2) {
  let l2 = dist(x1, y1, x2, y2) * dist(x1, y1, x2, y2);
  if (l2 == 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = max(0, min(1, t));
  return dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

// ==========================================
// 🖐️ 手部偵測共通函式（第一關專用）
// ==========================================
function updateIndexFingerPosition() {
  if (predictions.length > 0) {
    let annotations = predictions[0].annotations;
    if (annotations && annotations.indexFinger) {
      let rawX = annotations.indexFinger[3][0];
      let rawY = annotations.indexFinger[3][1];
      handX = width - rawX; handY = rawY; 
      return true;
    }
  }
  handX = mouseX; handY = mouseY; 
  return false; 
}

function drawHandSkeleton() {
  if (predictions.length > 0) {
    let hand = predictions[0];
    push(); translate(width, 0); scale(-1, 1);
    stroke(0, 255, 0); strokeWeight(2); noFill();
    let annotations = hand.annotations;
    drawFingerJoints(annotations.thumb); drawFingerJoints(annotations.indexFinger);
    drawFingerJoints(annotations.middleFinger); drawFingerJoints(annotations.ringFinger); drawFingerJoints(annotations.pinky);
    
    fill(0, 255, 0); noStroke();
    for (let i = 0; i < hand.landmarks.length; i++) {
      ellipse(hand.landmarks[i][0], hand.landmarks[i][1], 7, 7);
    }
    if (annotations.indexFinger) {
      let indexTip = annotations.indexFinger[3];
      fill(255, 0, 0); stroke(255); strokeWeight(2);
      ellipse(indexTip[0], indexTip[1], 15, 15); 
    }
    pop();
  }
}

function drawFingerJoints(fingerArr) {
  if (!fingerArr) return;
  for (let i = 0; i < fingerArr.length - 1; i++) {
    line(fingerArr[i][0], fingerArr[i][1], fingerArr[i+1][0], fingerArr[i+1][1]);
  }
}