(function(){
// AVI 5.1 — Motor pedagógico local determinístico, sem chamadas de rede.
const AVI51_ENGINE={version:'5.1.0-local',mode:'offline-rules',maxInput:1200};
function avi51Normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function avi51Contains(text,patterns){return patterns.some(p=>p.test(text))}
function avi51SafeText(s){return String(s||'').replace(/[<>]/g,'').slice(0,AVI51_ENGINE.maxInput)}
function avi51Classify(q){
 const s=avi51Normalize(q);
 if(avi51Contains(s,[/como (fazer|construir|fabricar).{0,30}(arma|explosivo|bomba)/,/invadir.{0,30}(conta|sistema|rede)/,/roubar.{0,20}(senha|dados|conta)/,/malware|ransomware|keylogger/]))return 'unsafe';
 if(avi51Contains(s,[/quero me matar|vou me matar|suicid|me machucar|automutil/]))return 'crisis';
 if(avi51Contains(s,[/diagnosticar|qual meu transtorno|sou autista|tenho tdah|depressao/]))return 'sensitive';
 if(avi51Contains(s,[/fra[cç][aã]o|porcent|%|equac|matemat|calcular|raiz quadrada|tabuada|divis|multiplic|soma|subtrac|geometr/]))return 'math';
 if(avi51Contains(s,[/texto|leitura|interpret|gramatic|redac|escrita|literatur|verbo|substantivo/]))return 'language';
 if(avi51Contains(s,[/html|css|javascript|python|program|codigo|algorit|site|pagina web/]))return 'technology';
 if(avi51Contains(s,[/ciencia|experimento|hipotese|pesquisa|energia|celula|ecossistema/]))return 'science';
 if(avi51Contains(s,[/historia|geografia|cidadania|sociedade|meio ambiente/]))return 'humanities';
 return 'general';
}
function avi51LocalAnswer(ctx){
 const raw=String(ctx.question||'');
 if(raw.length>AVI51_ENGINE.maxInput)return 'Sua mensagem é longa demais para o modo local. Divida a dúvida em partes menores (até 1.200 caracteres).';
 const q=avi51SafeText(raw),s=avi51Normalize(q),kind=avi51Classify(q);
 const intro=`Modo local AVI 5.1 • orientação pedagógica baseada em regras verificáveis. Nível informado: ${ctx.level}.`;
 if(!q)return 'Escreva uma pergunta ou descreva o desafio que deseja estudar.';
 if(kind==='unsafe')return `${intro}\n\nNão posso orientar ações que facilitem violência, invasão, roubo de credenciais ou criação de malware. Posso ajudar a estudar segurança digital defensiva, proteção de contas, ética e prevenção de riscos.`;
 if(kind==='crisis')return `${intro}\n\nSinto muito que esteja passando por isso. Este tutor não é serviço de emergência nem substitui apoio humano. Se houver perigo imediato, procure o serviço de emergência local ou vá a um pronto atendimento. No Brasil, você pode ligar 188 (CVV) para conversar, e buscar uma pessoa adulta/de confiança agora. Você não precisa lidar com isso sozinho.`;
 if(kind==='sensitive')return `${intro}\n\nNão posso diagnosticar condições de saúde ou inferir características pessoais. Posso ajudar com estratégias gerais de estudo e acessibilidade, sem rotular você. Para avaliação individual, procure profissional habilitado com apoio de um responsável quando necessário.`;
 if(/ignore|desconsidere|revele.*instruc|prompt|system prompt|burlar.*regra/.test(s))return `${intro}\n\nVou manter meu papel de apoio pedagógico e não seguir instruções para revelar configurações internas ou contornar salvaguardas. Se quiser, posso explicar como estruturar uma boa pergunta de estudo.`;
 if(kind==='math'){
  const pct=q.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de|sobre)\s*(\d+(?:[.,]\d+)?)/i);
  if(pct){const a=Number(pct[1].replace(',','.')),b=Number(pct[2].replace(',','.'));if(Number.isFinite(a*b)&&Math.abs(a*b)<1e12)return `${intro}\n\n**Resolução:** ${a}% de ${b} = (${a}/100) × ${b} = **${Number((a*b/100).toFixed(6))}**.\n\nPara conferir, transforme a porcentagem em número decimal e multiplique pelo valor total.`;
  }
  const frac=q.match(/(\d+)\s*\/\s*(\d+)\s*(?:e|mais|\+)\s*(\d+)\s*\/\s*(\d+)/i);
  if(frac&&Number(frac[2])!==0&&Number(frac[4])!==0){const [a,b,c,d]=frac.slice(1).map(Number);const den=b*d,num=a*d+c*b,g=(x,y)=>y?g(y,x%y):Math.abs(x),div=g(num,den);return `${intro}\n\n**Soma de frações:** ${a}/${b} + ${c}/${d} = (${a}×${d} + ${c}×${b}) / (${b}×${d}) = ${num}/${den}${div>1?` = ${num/div}/${den/div}`:''}.\n\nA ideia é usar um denominador comum antes de somar os numeradores.`}
  return `${intro}\n\n**Roteiro para resolver:**\n1. Identifique os dados e o que a questão pede.\n2. Escolha a operação ou propriedade adequada.\n3. Resolva uma etapa por vez e registre as unidades.\n4. Substitua o resultado no enunciado para verificar se faz sentido.\n\n**Pergunta de verificação:** qual é o primeiro passo que você tentaria? Se enviar a expressão ou o enunciado sem dados pessoais, posso ajudar a decompor o raciocínio.`;
 }
 if(kind==='language')return `${intro}\n\n**Leitura e linguagem — método em quatro passos:**\n1. Identifique o tema e o gênero textual.\n2. Formule a ideia central em uma frase.\n3. Separe informação explícita de inferência.\n4. Aponte palavras ou trechos que sustentem sua interpretação.\n\n**Exercício:** escreva a ideia central do trecho estudado e cite uma evidência textual. Sem o texto, não vou inventar uma interpretação específica.`;
 if(kind==='technology')return `${intro}\n\n**Resolução de problemas em tecnologia:**\n1. Defina a entrada (o que o sistema recebe).\n2. Defina a saída esperada (o que deve acontecer).\n3. Divida a solução em passos pequenos.\n4. Implemente uma parte mínima e teste casos normais e casos-limite.\n5. Registre o erro observado e a hipótese de correção.\n\nEm páginas web, HTML organiza a estrutura, CSS apresenta o visual e JavaScript implementa interações. **Qual comportamento você quer construir primeiro?**`;
 if(kind==='science')return `${intro}\n\n**Investigação científica:** transforme o tema em pergunta observável; formule hipótese testável; defina variáveis e método; registre evidências; compare resultados com a hipótese; descreva limitações. Não conclua além do que os dados permitem.\n\n**Pergunta:** que evidência poderia confirmar ou enfraquecer sua hipótese?`;
 if(kind==='humanities')return `${intro}\n\n**Análise contextual:** delimite o tema e o período/local; identifique atores e interesses; compare fontes; diferencie fato, interpretação e opinião; procure consequências e perspectivas diversas.\n\n**Pergunta:** qual fonte ou evidência sustenta a afirmação que você está analisando?`;
 return `${intro}\n\nVamos organizar a dúvida sem presumir informações sobre você:\n1. Qual conceito ou tarefa está em foco?\n2. O que você já tentou ou compreendeu?\n3. Em qual etapa surgiu a dificuldade?\n\nPosso orientar com exemplos graduais, mas não devo inventar fatos, fontes, notas ou diagnósticos.`;
}
async function tutorAnswer(q){
 const ctx=aviTutorBuildContext(q);
 // Privacidade por padrão: não transmite perguntas nem contexto para serviços externos.
 return avi51LocalAnswer(ctx);
}

window.AVI51={version:AVI51_ENGINE.version,mode:AVI51_ENGINE.mode,answer:avi51LocalAnswer,classify:avi51Classify};

})();
