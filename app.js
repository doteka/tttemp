(() => {
  // 원본 TSX 기준 상수
  const MAX_SECONDS = 60 * 60; // 60분(3600초)
  const RADIUS = 140;
  const CENTER = 160;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // DOM
  const timeText = document.getElementById("timeText");
  const percentText = document.getElementById("percentText");
  const dial = document.getElementById("dial");
  const markersGroup = document.getElementById("markers");
  const progressCircle = document.getElementById("progressCircle");
  const handle = document.getElementById("pointer-events-none");
  const handleOuter = document.getElementById("handleOuter");
  const handleInner = document.getElementById("handleInner");
  const toggleBtn = document.getElementById("toggleBtn");
  const resetBtn = document.getElementById("resetBtn");
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  const center_default = document.getElementById("default_centerImg");
  const center_start = document.getElementById("centerImg");

  // state (원본 TSX와 동일 개념)
  let totalSeconds = 0;       // 설정된 총 시간
  let remainingSeconds = 0;   // 남은 시간
  let isRunning = false;
  let isDragging = false;
  let intervalId = null;
  let tried_iou = 0.4;
  let shouldKeepOn = false;

  // 초기 설정
  progressCircle.setAttribute("stroke-dasharray", String(CIRCUMFERENCE));
  // 초기 offset은 update()에서 계산
  buildTimeMarkers();
  requestNotificationPermissionLikeOriginal();
  updateUI();

  let wakeLock = null;

  async function keepScreenOn() {
    if (!('wakeLock' in navigator)) return false;
    if (document.visibilityState !== 'visible') return false;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      return true;
    } catch {
      wakeLock = null;
      return false;
    }
  }

  async function allowScreenOff() {
    try { if (wakeLock) await wakeLock.release(); } catch {}
    wakeLock = null;
  }


  // ===== 이벤트 =====
  dial.addEventListener("pointerdown", (e) => {
    if (isRunning) return;
    isDragging = true;
    dial.setPointerCapture?.(e.pointerId);
    handleDrag(e.clientX, e.clientY);
  });

  dial.addEventListener("pointermove", (e) => {
    if (!isDragging || isRunning) return;
    handleDrag(e.clientX, e.clientY);
  });

  dial.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    try { dial.releasePointerCapture?.(e.pointerId); } catch {}
  });

  dial.addEventListener("pointercancel", () => {
    isDragging = false;
  });

  toggleBtn.addEventListener("click", () => {
    // 원본 TSX: toggleTimer는 그냥 isRunning만 토글 (remainingSeconds가 0이어도 그대로)
    isRunning = !isRunning;

    if (isRunning) keepScreenOn().catch(() => {});
    else allowScreenOff().catch(() => {});
    
    syncRunningEffects();
    updateUI();
  });

  resetBtn.addEventListener("click", () => {
    // 원본 TSX: resetTimer
    center_default.style.display="block";
    center_start.style.display="none";
    center_start.style.animationPlayState = "paused";
    center_start.setAttribute('data-type', 'happy');
    isRunning = false;
    totalSeconds = 0;
    remainingSeconds = 0;
    clearTimerInterval();
    syncRunningEffects();
    updateUI();
  });

  // ===== 로직(원본 TSX의 useEffect 타이머 동작을 그대로) =====
  function syncRunningEffects() {
    // 아이콘 토글
    if (isRunning) {
      playIcon.style.display = "none";
      pauseIcon.style.display = "";
      center_default.style.display="none";
      center_start.style.display="block";
      center_start.style.animationPlayState = "running";
      // 원본: isRunning이면 progressCircle에 transition-all duration-1000 ease-linear 부여
      progressCircle.classList.add("transition-all", "duration-1000", "ease-linear");
    } else {
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
      center_start.style.animationPlayState = "paused";
      // center_default.style.display="";
      // center_start.style.display="none";
      progressCircle.classList.remove("transition-all", "duration-1000", "ease-linear");
    }

    // 원본 TSX: isRunning && remainingSeconds > 0 일 때만 interval 시작
    if (isRunning && remainingSeconds > 0) {
      clearTimerInterval();
      intervalId = window.setInterval(() => {
        if (remainingSeconds <= 1) {
          isRunning = false;

          // 완료 알림 (원본 TSX와 동일 조건)
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("뽀모도로 타이머 완료!", { body: "시간이 다 되었습니다!" });
            } catch {}
          }

          remainingSeconds = 0;
          clearTimerInterval();
          syncRunningEffects();
          updateUI();
          return;
        }

        remainingSeconds -= 1;
        updateUI();
      }, 1000);
    } else {
      clearTimerInterval();
    }
  }

  function clearTimerInterval() {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // ===== 드래그 =====
  function handleDrag(clientX, clientY) {
    const angle = getAngleFromEvent(clientX, clientY);
    const seconds = angleToSeconds(angle);
    totalSeconds = seconds;
    remainingSeconds = seconds;

    // 원본: 드래그로 시간 잡으면 버튼 활성(단, totalSeconds===0이면 비활성)
    updateUI();
  }

  function getAngleFromEvent(clientX, clientY) {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    // atan2: -PI~PI
    let angle = Math.atan2(deltaY, deltaX);
    // 12시 방향을 0으로
    angle = angle + Math.PI / 2;
    // 0~2PI
    if (angle < 0) angle += 2 * Math.PI;

    return angle;
  }

  function angleToSeconds(angle) {
    const progress = angle / (2 * Math.PI);
    const seconds = Math.round(progress * MAX_SECONDS);
    return Math.min(Math.max(seconds, 0), MAX_SECONDS);
  }

  // ===== UI 계산(원본 TSX 그대로) =====
  function updateUI() {
    // 텍스트
    timeText.textContent = formatTime(remainingSeconds);

    const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) : 0;
    percentText.textContent = `${Math.round(progress * 100)}%`;
    console.log(progress);
    if(progress < tried_iou) 
      center_start.setAttribute('data-type', 'tried');
    else
      center_start.setAttribute('data-type', 'happy');
    

    // progress circle offset
    // 원본 TSX:
    // totalProgress = totalSeconds / 3600
    // remainingStrokeDashoffset = circumference * (1 - progress * totalProgress)
    const totalProgress = totalSeconds / MAX_SECONDS;
    const remainingStrokeDashoffset = CIRCUMFERENCE * (1 - progress * totalProgress);
    progressCircle.setAttribute("stroke-dashoffset", String(remainingStrokeDashoffset));

    // handle position
    // 수정전 코드, 정지를 하면 초기 설정 값으로 게이지가 튐 
    // const currentProgress = isRunning ? (remainingSeconds / MAX_SECONDS) : totalProgress;

    // 수정 후 코드, 정리를 해도 게이지가 유지됨
    const currentProgress = totalSeconds > 0 ? (remainingSeconds / MAX_SECONDS) : 0;
    const handleAngle = currentProgress * 2 * Math.PI;
    const handleX = CENTER + RADIUS * Math.cos(handleAngle - Math.PI / 2);
    const handleY = CENTER + RADIUS * Math.sin(handleAngle - Math.PI / 2);
    // handleOuter.setAttribute("cx", handleX.toFixed(3));
    // handleOuter.setAttribute("cy", handleY.toFixed(3));
    // handleInner.setAttribute("cx", handleX.toFixed(3));
    // handleInner.setAttribute("cy", handleY.toFixed(3));
    handle.setAttribute("transform", `translate(${handleX.toFixed(3)} ${handleY.toFixed(3)})`);


    // 버튼 disabled (원본 TSX: totalSeconds===0일 때만 start disabled)
    toggleBtn.disabled = (totalSeconds === 0);

    // running effect는 상태 변화 시 맞춰주기
    // (드래그로 total/remaining 변경 시 isRunning이 false인 경우가 많아서 안전하게)
    // syncRunningEffects();
  }

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function buildTimeMarkers() {
    const timeMarkers = [10, 20, 30, 40, 50, 60];
    const markerRadius = 165;

    markersGroup.innerHTML = "";
    for (const minutes of timeMarkers) {
      const angle = (minutes / 60) * 2 * Math.PI - Math.PI / 2;
      const x = 160 + markerRadius * Math.cos(angle);
      const y = 160 + markerRadius * Math.sin(angle);

      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x.toFixed(3));
      t.setAttribute("y", y.toFixed(3));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("class", "fill-gray-600 text-sm font-medium pointer-events-none select-none");
      t.textContent = String(minutes);
      markersGroup.appendChild(t);
    }
  }

  // ===== Notification (원본처럼 로드 시 요청) =====
  function requestNotificationPermissionLikeOriginal() {
    if ("Notification" in window && Notification.permission === "default") {
      // 원본 TSX: mount 시 requestPermission 호출
      try { Notification.requestPermission(); } catch {}
    }
  }
})();
