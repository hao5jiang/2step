const $ = id => document.getElementById(id);
const identityOffsets = [.06425,.06475,.06025,.06625,.078,.067,.07825,.07825,.07825,.07825,.05575,.05225,.07,.07025,.07025,.07025,.07025,.07025];
const multiOffsets = [.044,.0475,.0385,.0445,.0565,.0445,.0565,.0565,.05675,.0565,.0385,.0385,.04425,.0565,.0565,.0565,.0565,.04425];
const focus = {
  identity: new Set([28,36,44,52,60,68,76,100,108,116,124,132]),
  preference: new Set([28,36,52,60,68,76,100,108,116,124,132,140])
};
const specs = {
  identity: {primary:'rendered', secondary:'bypassed', primaryLabel:'双耳渲染版', secondaryLabel:'原版 Bypassed'},
  preference: {primary:'rendered', secondary:'multichannel', primaryLabel:'新版双声道输入的双耳渲染', secondaryLabel:'旧版多声道输入的双耳渲染'}
};
const defaultReady = {rendered:false, bypassed:false, multichannel:false};
let testKind='identity', sourceMode='default', segmentMode='focus', context, buffers={}, trials=[], index=0, playback=null, answered=false;

function clock(t) { return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`; }
function randomBit() { const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]&1; }
function status(message) { $('loadStatus').textContent=message; }
function stop() {
  if (playback) { try { playback.source.stop(); } catch {} playback=null; }
  for (const slot of ['A','B']) {
    $(`play${slot}`).classList.remove('active');
    $(`play${slot}`).querySelector('small').textContent='点击播放';
  }
}
function available() { const s=specs[testKind]; return defaultReady[s.primary] && defaultReady[s.secondary]; }
function updateStart() {
  $('start').disabled=sourceMode==='default' ? !available() : !$('primaryFile').files.length || !$('secondaryFile').files.length;
}
function refreshStatus() {
  updateStart();
  status(sourceMode==='default' ? (available() ? '默认音频已就绪，可以直接开始。' : '正在检查默认音频…') : ($('start').disabled ? '请选择两份录音。' : '两份文件已选择，可以开始。'));
}
function chooseKind(next) {
  testKind=next;
  $('kindIdentity').classList.toggle('selected',next==='identity');
  $('kindPreference').classList.toggle('selected',next==='preference');
  $('heroTitle').innerHTML=next==='identity' ? '你能听出<br><em>哪段经过双耳渲染</em>吗？' : '哪种双耳渲染<br><em>听起来更舒服？</em>';
  $('heroText').textContent=next==='identity' ? '每轮听同一时间点的 A 与 B，然后指出经过 APL 双耳渲染的版本。A/B 身份每轮重新随机分配，作答后才揭晓。' : '比较旧版多声道输入与新版双声道输入的双耳渲染。选择听起来更舒服的 A、B，或“不确定哪个好”。没有标准答案。';
  $('defaultPairLabel').textContent=next==='identity' ? '《2step》双耳渲染 / Bypassed' : '《2step》新版双声道 / 旧版多声道';
  $('defaultInfo').textContent=next==='identity' ? '默认试听使用新版双声道双耳渲染录音与此前的 Bypassed 录音。身份测试会给双耳版额外 +0.6 dB 播放增益；音量可能成为判断线索。' : '默认试听使用新版双声道输入和旧版多声道输入的 APL 双耳渲染录音。两份输出都是立体声，播放时逐段匹配平均电平。';
  $('primaryLabel').textContent=specs[next].primaryLabel;
  $('secondaryLabel').textContent=specs[next].secondaryLabel;
  for (const role of ['primary','secondary']) {
    $(`${role}File`).value=''; $(`${role}Name`).textContent=`选择${role==='primary' ? '第一' : '第二'}份音频文件`;
    $(`${role}File`).closest('.filebox').classList.remove('loaded');
  }
  refreshStatus();
}
function chooseSource(next) {
  sourceMode=next;
  $('useDefault').classList.toggle('selected',next==='default');
  $('useCustom').classList.toggle('selected',next==='custom');
  $('defaultInfo').classList.toggle('hidden',next!=='default');
  $('customFiles').classList.toggle('hidden',next!=='custom');
  $('customInfo').classList.toggle('hidden',next!=='custom');
  document.querySelector('[data-mode="focus"]').textContent=next==='default' ? '重点 12 段' : '前 6 段';
  document.querySelector('[data-mode="all"]').textContent=next==='default' ? '全曲 18 段' : '全部片段';
  refreshStatus();
}
$('kindIdentity').addEventListener('click',()=>chooseKind('identity'));
$('kindPreference').addEventListener('click',()=>chooseKind('preference'));
$('useDefault').addEventListener('click',()=>chooseSource('default'));
$('useCustom').addEventListener('click',()=>chooseSource('custom'));
for (const name of Object.keys(defaultReady)) {
  fetch(`audio/${name}.m4a`,{method:'HEAD'}).then(r=>{ defaultReady[name]=r.ok; refreshStatus(); }).catch(()=>{ defaultReady[name]=false; refreshStatus(); });
}
for (const role of ['primary','secondary']) {
  $(`${role}File`).addEventListener('change',e=>{
    const file=e.target.files[0];
    $(`${role}Name`).textContent=file?.name || '尚未选择';
    e.target.closest('.filebox').classList.toggle('loaded',Boolean(file));
    refreshStatus();
  });
}
document.querySelectorAll('.modebtn').forEach(button=>button.addEventListener('click',()=>{
  segmentMode=button.dataset.mode;
  document.querySelectorAll('.modebtn').forEach(b=>b.classList.toggle('selected',b===button));
}));

async function loadDefault(name) {
  const response=await fetch(`audio/${name}.m4a`);
  if (!response.ok) throw new Error(`默认音频读取失败（HTTP ${response.status}）`);
  return context.decodeAudioData(await response.arrayBuffer());
}
async function loadFile(file) { return context.decodeAudioData(await file.arrayBuffer()); }
$('start').addEventListener('click',async()=>{
  $('start').disabled=true; status('正在读取和解码两份录音，请稍候…');
  try {
    context ||= new AudioContext(); await context.resume();
    const s=specs[testKind];
    const inputs=sourceMode==='default' ? [loadDefault(s.primary),loadDefault(s.secondary)] : [loadFile($('primaryFile').files[0]),loadFile($('secondaryFile').files[0])];
    const [primary,secondary]=await Promise.all(inputs);
    if (Math.min(primary.duration,secondary.duration)<8) throw new Error('录音时长不足 8 秒');
    if (primary.numberOfChannels!==2 || secondary.numberOfChannels!==2) throw new Error('两份文件都需要是立体声录音');
    buffers={primary,secondary}; launch();
  } catch(error) {
    status(`加载失败：${error.message}。如果自选 FLAC 无法解码，请改用 WAV 或 AAC。`); updateStart();
  }
});

function makeWindows() {
  if (sourceMode==='default') return Array.from({length:18},(_,i)=>({start:4+i*8,duration:8,primaryOffset:testKind==='identity' ? identityOffsets[i] : 0,secondaryOffset:testKind==='preference' ? multiOffsets[i] : 0}));
  return Array.from({length:Math.min(100,Math.floor(Math.min(buffers.primary.duration,buffers.secondary.duration)/8))},(_,i)=>({start:i*8,duration:8,primaryOffset:0,secondaryOffset:0}));
}
function launch() {
  stop();
  trials=makeWindows().filter((w,i)=>segmentMode==='all' || (sourceMode==='default' ? focus[testKind].has(w.start) : i<6)).map(w=>({...w,primarySlot:randomBit() ? 'A' : 'B',answer:null}));
  index=0;
  $('setup').classList.add('hidden'); $('result').classList.add('hidden'); $('test').classList.remove('hidden');
  $('testQuestion').textContent=testKind==='identity' ? '双耳渲染的是哪段？' : '哪段听起来更舒服？';
  $('testHint').textContent=testKind==='identity' ? '可以反复切换播放。作答前不会显示身份。' : '可以反复切换播放。没有标准答案，也可以选择不确定。';
  $('answerPrompt').textContent=testKind==='identity' ? '我的判断：双耳渲染是' : '我更喜欢';
  $('chooseUnsure').classList.toggle('hidden',testKind!=='preference');
  showTrial();
}
function showTrial() {
  stop(); answered=false;
  const t=trials[index];
  $('progress').textContent=`02 / 第 ${index+1} 段，共 ${trials.length} 段`;
  $('timeLabel').textContent=`${clock(t.start)} — ${clock(t.start+t.duration)}`;
  $('progressFill').style.width=`${100*index/trials.length}%`;
  $('feedback').classList.add('hidden'); $('feedback').classList.remove('wrong');
  $('next').classList.add('hidden');
  for (const id of ['chooseA','chooseB','chooseUnsure']) $(id).disabled=false;
  for (const slot of ['A','B']) $(`volume${slot}`).value='0';
  updateVolume();
}
function stats(buffer,start,duration) {
  const from=Math.floor(start*buffer.sampleRate),to=Math.min(buffer.length,Math.floor((start+duration)*buffer.sampleRate));
  let squares=0,peak=0,count=0;
  for (let ch=0;ch<buffer.numberOfChannels;ch++) {
    const data=buffer.getChannelData(ch);
    for (let i=from;i<to;i++) { const v=data[i]; squares+=v*v; peak=Math.max(peak,Math.abs(v)); count++; }
  }
  return {rms:Math.sqrt(squares/count),peak};
}
function roleForSlot(t,slot) { return t.primarySlot===slot ? 'primary' : 'secondary'; }
function levels(t) {
  if (!t.metrics) t.metrics={
    primary:stats(buffers.primary,t.start+t.primaryOffset,t.duration),
    secondary:stats(buffers.secondary,t.start+t.secondaryOffset,t.duration)
  };
  const a=t.metrics.primary,b=t.metrics.secondary,target=Math.min(a.rms,b.rms);
  const boost=testKind==='identity' ? 10**(.6/20) : 1;
  const sliderA=Number($('volumeA').value),sliderB=Number($('volumeB').value);
  const dbPrimary=t.primarySlot==='A' ? sliderA : sliderB;
  const dbSecondary=t.primarySlot==='A' ? sliderB : sliderA;
  const requestedPrimary=target/Math.max(a.rms,1e-8)*boost*10**(dbPrimary/20);
  const requestedSecondary=target/Math.max(b.rms,1e-8)*10**(dbSecondary/20);
  const ceiling=10**(-3/20);
  const safetyScale=Math.min(1,ceiling/Math.max(a.peak*requestedPrimary,b.peak*requestedSecondary,1e-8));
  return {primary:requestedPrimary*safetyScale,secondary:requestedSecondary*safetyScale,safetyScale};
}
function updateVolume() {
  const t=trials[index]; if (!t) return;
  for (const slot of ['A','B']) {
    const value=Number($(`volume${slot}`).value);
    $(`volumeValue${slot}`).textContent=`${value>=0 ? '+' : '−'}${Math.abs(value).toFixed(value%1 ? 1 : 0)} dB`;
  }
  const current=levels(t);
  $('volumeSafety').textContent=current.safetyScale<.999 ? '已启动防削波：网页同时降低 A、B 的输出，保留设定的相对音量差；峰值仍留至少 3 dB 余量。' : '峰值留至少 3 dB 余量。每段开始时 A、B 音量都会归零。';
  if (playback && context.currentTime<playback.endAt-.03) {
    const now=context.currentTime,level=current[roleForSlot(t,playback.slot)],param=playback.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(playback.level,now);
    const rampEnd=Math.min(now+.025,playback.endAt-.12);
    if (rampEnd>now) param.linearRampToValueAtTime(level,rampEnd);
    if (playback.endAt-.12>rampEnd) param.setValueAtTime(level,playback.endAt-.12);
    param.linearRampToValueAtTime(0,playback.endAt);
    playback.level=level;
  }
}
for (const slot of ['A','B']) $(`volume${slot}`).addEventListener('input',updateVolume);
function play(slot) {
  stop();
  const t=trials[index],role=roleForSlot(t,slot);
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffers[role]; source.connect(gain).connect(context.destination);
  const now=context.currentTime+.02,level=levels(t)[role];
  gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(level,now+.12);
  gain.gain.setValueAtTime(level,now+t.duration-.12);
  gain.gain.linearRampToValueAtTime(0,now+t.duration);
  source.start(now,t.start+t[`${role}Offset`],t.duration);
  playback={source,gain,slot,level,endAt:now+t.duration};
  $(`play${slot}`).classList.add('active');
  $(`play${slot}`).querySelector('small').textContent='播放中 · 点击重播';
  source.onended=()=>{ if (playback?.source===source) stop(); };
}
for (const slot of ['A','B']) $(`play${slot}`).addEventListener('click',()=>play(slot));
function choose(answer) {
  if (answered) return;
  answered=true; stop();
  const t=trials[index]; t.answer=answer;
  if (testKind==='identity') {
    const correct=answer===t.primarySlot;
    $('feedback').textContent=`${correct ? '判断正确' : '判断错误'} · 双耳渲染是 ${t.primarySlot}，Bypassed 是 ${t.primarySlot==='A' ? 'B' : 'A'}`;
    $('feedback').classList.toggle('wrong',!correct);
  } else {
    $('feedback').textContent=answer==='unsure' ? '已记录：不确定哪个好。继续下一段。' : `已记录：你更喜欢 ${answer}。继续下一段。`;
  }
  $('feedback').classList.remove('hidden');
  for (const id of ['chooseA','chooseB','chooseUnsure']) $(id).disabled=true;
  $('next').textContent=index===trials.length-1 ? '查看结果 →' : '下一段 →';
  $('next').classList.remove('hidden');
}
$('chooseA').addEventListener('click',()=>choose('A'));
$('chooseB').addEventListener('click',()=>choose('B'));
$('chooseUnsure').addEventListener('click',()=>choose('unsure'));
$('next').addEventListener('click',()=>{ if (++index<trials.length) showTrial(); else showResult(); });
function trialRow(t,i) {
  const row=document.createElement('div'),left=document.createElement('strong'),right=document.createElement('span');
  row.className='trial'; left.textContent=`${String(i+1).padStart(2,'0')}  ${clock(t.start)}–${clock(t.start+t.duration)}`;
  if (testKind==='identity') right.textContent=`${t.answer===t.primarySlot ? '✓ 正确' : '× 错误'} · 双耳渲染 ${t.primarySlot} · 你选 ${t.answer}`;
  else {
    const choice=t.answer==='unsure' ? '不确定' : t.answer===t.primarySlot ? '新版双声道' : '旧版多声道';
    right.textContent=`你选 ${choice} · A=${t.primarySlot==='A' ? '新版' : '旧版'} · B=${t.primarySlot==='B' ? '新版' : '旧版'}`;
  }
  row.append(left,right); return row;
}
function showResult() {
  stop(); $('test').classList.add('hidden'); $('result').classList.remove('hidden');
  $('result').classList.toggle('preference',testKind==='preference');
  if (testKind==='identity') {
    const correct=trials.filter(t=>t.answer===t.primarySlot).length;
    $('resultKind').textContent='身份识别'; $('score').textContent=`${correct} / ${trials.length}`;
    $('resultTitle').textContent=correct===trials.length ? '全部辨认正确。' : '这就是你的身份识别结果。';
    $('resultText').textContent='双耳版额外提高了 0.6 dB，可能提供音量线索。建议结合听感，不把这次成绩当作严格等响测试的结果。';
  } else {
    const newCount=trials.filter(t=>t.answer===t.primarySlot).length;
    const oldCount=trials.filter(t=>t.answer!=='unsure' && t.answer!==t.primarySlot).length;
    const unsure=trials.filter(t=>t.answer==='unsure').length;
    $('resultKind').textContent='听感偏好'; $('score').textContent=`${newCount} · ${oldCount} · ${unsure}`;
    $('resultTitle').textContent='你的偏好分布';
    $('resultText').textContent=`新版双声道 ${newCount} 段 · 旧版多声道 ${oldCount} 段 · 不确定 ${unsure} 段。没有标准答案；可以重新随机再听一轮。`;
  }
  $('trialList').replaceChildren(...trials.map(trialRow));
  $('result').scrollIntoView({behavior:'smooth'});
}
function backSetup() {
  stop(); $('test').classList.add('hidden'); $('result').classList.add('hidden'); $('setup').classList.remove('hidden');
  refreshStatus(); $('setup').scrollIntoView({behavior:'smooth'});
}
$('again').addEventListener('click',launch);
$('backFromTest').addEventListener('click',backSetup);
$('backFromResult').addEventListener('click',backSetup);
