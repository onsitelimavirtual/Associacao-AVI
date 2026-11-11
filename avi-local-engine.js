(function(){
'use strict';
const VERSION='5.7.0-local-kb';
const MAX_INPUT=2000;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}%+\-*/=.,\s]/gu,' ').replace(/\s+/g,' ').trim();
const safe=s=>String(s||'').replace(/[<>]/g,'').slice(0,MAX_INPUT);
const has=(s,rx)=>rx.some(r=>r.test(s));
const KB=()=>window.AVI_KB&&Array.isArray(window.AVI_KB.entries)?window.AVI_KB.entries:[];
function classify(q){
 const s=normalize(q);
 if(has(s,[/como (fazer|construir|fabricar).{0,35}(arma|explosivo|bomba)/,/invadir.{0,30}(conta|sistema|rede)/,/roubar.{0,20}(senha|dados|conta)/,/malware|ransomware|keylogger|phishing kit/]))return 'unsafe';
 if(has(s,[/quero me matar|vou me matar|suicid|me machucar|automutil/]))return 'crisis';
 if(has(s,[/diagnosticar|qual meu transtorno|sou autista|tenho tdah|depressao/]))return 'sensitive';
 if(has(s,[/quanto e|calcule|calcular|resolva|porcent|%|frac[aã]o|equac|matemat|raiz quadrada|tabuada|divis|multiplic|soma|subtrac|geometr|regra de tres/]))return 'math';
 return 'knowledge';
}
function tokenize(s){return normalize(s).split(/[^a-z0-9%]+/).filter(x=>x.length>2&&!['como','qual','quais','para','com','uma','que','dos','das','por','isso','sobre','meu','minha','seu','sua','pode','explica','explique','quero','aprender','sem','algo','consta','biblioteca','correspondencia','nao','nem','mais','muito','muitas','muitos'].includes(x))}
function retrieve(q,ctx={}){
 const terms=tokenize([q,ctx.goal||''].join(' '));
 const area=normalize(ctx.area||'');
 return KB().map(e=>{
  const title=new Set(tokenize(e.title)),tags=new Set(tokenize((e.tags||[]).join(' '))),body=new Set(tokenize([e.summary,e.explain,e.example].join(' ')));
  let score=0;
  for(const t of terms){if(title.has(t))score+=5;if(tags.has(t))score+=3;if(body.has(t))score+=1}
  if(score>0&&area&&area!=='geral'&&normalize(e.area)===area)score+=2;
  if(normalize(ctx.goal||'')&&title.includes(normalize(ctx.goal)))score+=3;
  return {entry:e,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
}
function percent(q){
 const m=q.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de|sobre)\s*(\d+(?:[.,]\d+)?)/i);
 if(!m)return null;
 const a=Number(m[1].replace(',','.')),b=Number(m[2].replace(',','.')),v=a*b/100;
 if(!Number.isFinite(v)||Math.abs(v)>1e12)return null;
 return `Cálculo direto\n${a}% significa ${a}/100.\n${a}% de ${b} = (${a}/100) × ${b} = ${Number(v.toFixed(8))}.\n\nConferência: ${a/100} × ${b} = ${Number(v.toFixed(8))}.`;
}
function fraction(q){
 const m=q.match(/(\d+)\s*\/\s*(\d+)\s*([+\-])\s*(\d+)\s*\/\s*(\d+)/);
 if(!m)return null;
 const a=+m[1],b=+m[2],op=m[3],c=+m[4],d=+m[5];if(!b||!d)return 'O denominador de uma fração não pode ser zero.';
 const n=op==='+'?a*d+c*b:a*d-c*b,den=b*d,g=(x,y)=>y?g(y,x%y):Math.abs(x),div=g(n,den)||1;
 return `Resolução de frações\n${a}/${b} ${op} ${c}/${d} = (${a}×${d} ${op} ${c}×${b}) / (${b}×${d}) = ${n}/${den}.\nForma simplificada: ${n/div}/${den/div}.\n\nA ideia é obter um denominador comum antes de operar os numeradores.`;
}
function arithmetic(q){
 const m=q.match(/(?:quanto e|calcule|resolva)?\s*(-?\d+(?:[.,]\d+)?(?:\s*[+\-*/x×÷]\s*-?\d+(?:[.,]\d+)?){1,5})\s*\??$/i);
 if(!m)return null;
 let expr=m[1].replace(/,/g,'.').replace(/[x×]/g,'*').replace(/÷/g,'/');
 if(!/^[\d\s.+*/-]+$/.test(expr))return null;
 const nums=expr.match(/\d+(?:\.\d+)?/g)||[];if(nums.length>6)return null;
 // Safe shunting-yard evaluator; no eval/Function.
 const tokens=expr.match(/\d+(?:\.\d+)?|[+\-*/]/g)||[];
 if(tokens.join('')!==expr.replace(/\s/g,''))return null;
 const values=[],ops=[],prec={'+':1,'-':1,'*':2,'/':2};
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];
  if(i%2===0){const n=Number(t);if(!Number.isFinite(n))return null;values.push(n)}
  else {if(!(t in prec))return null;while(ops.length&&prec[ops[ops.length-1]]>=prec[t]){const op=ops.pop(),b=values.pop(),a=values.pop();if(op==='/'&&b===0)return 'A divisão por zero não está definida.';values.push(op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b)}ops.push(t)}
 }
 while(ops.length){const op=ops.pop(),b=values.pop(),a=values.pop();if(op==='/'&&b===0)return 'A divisão por zero não está definida.';values.push(op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b)}
 if(values.length!==1||!Number.isFinite(values[0])||Math.abs(values[0])>1e12)return null;
 return `Resultado: ${Number(values[0].toFixed(8))}.\n\nResolvi respeitando a prioridade das operações: multiplicação e divisão antes de adição e subtração.`;
}
function levelGuidance(level){
 const l=normalize(level);
 if(l==='iniciante')return 'Vou começar pelo conceito e por um exemplo simples.';
 if(l==='avancado')return 'Vou destacar relações, limites e uma aplicação mais exigente.';
 return 'Vou organizar a explicação em etapas e conectar conceito e aplicação.';
}
function answer(ctx){
 const raw=String(ctx.question||'');
 if(raw.length>MAX_INPUT)return `Sua mensagem ultrapassa ${MAX_INPUT} caracteres. Divida a dúvida em partes menores para que eu possa analisá-la com clareza.`;
 const q=safe(raw),s=normalize(q),kind=classify(q);
 if(!q)return 'Escreva uma pergunta ou descreva o desafio que deseja estudar.';
 if(kind==='unsafe')return 'Não posso orientar ações que facilitem violência, invasão, roubo de credenciais ou criação de malware. Posso ajudar com segurança digital defensiva, proteção de contas, ética e prevenção de riscos.';
 if(kind==='crisis')return 'Sinto muito que esteja passando por isso. Este tutor não é serviço de emergência. Se houver perigo imediato, procure o serviço de emergência local ou um pronto atendimento e chame agora uma pessoa de confiança para ficar com você. No Brasil, o CVV atende pelo 188, 24 horas. Você merece apoio humano neste momento.';
 if(kind==='sensitive')return 'Não posso diagnosticar condições de saúde ou inferir características pessoais. Posso ajudar com estratégias gerais de aprendizagem e acessibilidade. Para uma avaliação individual, procure profissional habilitado.';
 if(/ignore|desconsidere|revele.*instruc|system prompt|burlar.*regra|mostre.*chave/.test(s))return 'Vou manter meu papel de apoio pedagógico e não revelar configurações internas nem contornar salvaguardas. Posso explicar como formular uma pergunta de estudo clara.';
 if(kind==='math'||/\d+\s*\/\s*\d+/.test(q)){const direct=percent(q)||fraction(q)||arithmetic(q);if(direct)return direct}
 const hits=retrieve(q,ctx);
 if(hits.length){
  const e=hits[0].entry,related=hits.slice(1).map(x=>x.entry.title);
  const level=levelGuidance(ctx.level);
  let out=`${e.title}\n${e.summary}\n\n${level}\n\nExplicação\n${e.explain}\n\nExemplo\n${e.example}\n\nComo estudar\n${e.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nPratique\n${e.practice}\n\nConfira sua compreensão\n${e.check}\n\nAtenção a um erro comum\n${e.misconception}`;
  if(ctx.goal&&ctx.goal!=='não informado')out+=`\n\nSeu objetivo informado: ${ctx.goal}. Use as etapas acima para avançar nesse objetivo.`;
  if(ctx.priority&&ctx.priority!=='sem habilidade prioritária identificada')out+=`\n\nPonto de atenção do seu histórico local: ${ctx.priority}. Essa indicação é apenas um apoio formativo, não um diagnóstico.`;
  if(related.length)out+=`\n\nAssuntos relacionados na biblioteca: ${related.join('; ')}.`;
  out+=`\n\nReferência: Biblioteca local de aprendizagem AVI (${e.id}). Conteúdo didático de apoio; confira orientações curriculares e materiais da sua turma quando aplicável.`;
  return out;
 }
 if(kind==='math')return 'Posso ajudar com cálculo, frações, porcentagem, proporcionalidade, equações e geometria. Envie a expressão completa ou o enunciado. Se houver unidades, inclua-as para que eu confira o resultado.';
 return `Ainda não encontrei um tópico suficientemente próximo na biblioteca local para responder com segurança.\n\nPara evitar inventar informações, diga a disciplina, o conceito e o que deseja fazer (compreender, resolver, comparar ou praticar). Também pode escolher uma área em “Contexto de aprendizagem”.\n\nA biblioteca atual cobre matemática, linguagens, ciências, programação, cidadania, pensamento crítico e estratégias de estudo.`;
}
window.AVI51={version:VERSION,mode:'offline-curated-kb',answer,classify,retrieve,libraryCount:KB().length};
})();