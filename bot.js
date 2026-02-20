const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');

// CONFIGURAÇÕES
const ALOJAMENTO = '258834788141'; // Número para pareamento

// ========= CONFIGURAÇÃO GEMINI API ==========
const GEMINI_API_KEY = 'AIzaSyASNFrygCbyN40rRyK5q9Wdz8o-ptlSJT0';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';// ========= USUÁRIOS AUTORIZADOS ==========
const USUARIOS_AUTORIZADOS = {
    '170982698418411': {
        nome: 'Yanick',
        saudacao: 'Oie Yanick, pronto para estudar? 📚',
        curso1: 'economia',
        curso2: 'engenharia_informatica',
        universidade_1: 'UniZambeze',
        universidade_2: 'UEM',
        notas_corte_interesse: [14.5, 16.0],
        nivel: 1,
        pontos: 0
    },
    '67336916701388': {
        nome: 'Iracema',
        saudacao: 'Oie Iracema, pronta para estudar? 📚',
        curso1: 'medicina',
        curso2: null,
        universidade_1: 'UEM',
        universidade_2: null,
        notas_corte_interesse: [17.2],
        nivel: 1,
        pontos: 0
    },
    '120363423872490457': {
        nome: 'Precious',
        saudacao: 'Oie Precious, pronto para estudar? 📚',
        curso1: 'engenharia_electronica',
        curso2: 'economia',
        universidade_1: 'UEM',
        universidade_2: null,
        notas_corte_interesse: [15.5, 16.0],
        nivel: 1,
        pontos: 0
    }
};

const IDs_AUTORIZADOS = Object.keys(USUARIOS_AUTORIZADOS);// ========= FUNÇÕES AUXILIARES ==========
function extrairNumero(id) {
    if (!id) return '';
    return id.split('@')[0];
}

function isUsuarioAutorizado(senderId) {
    const numero = extrairNumero(senderId);
    return IDs_AUTORIZADOS.includes(numero);
}

function getNomeUsuario(senderId) {
    const numero = extrairNumero(senderId);
    return USUARIOS_AUTORIZADOS[numero]?.nome || 'Aluno';
}

function getSaudacao(senderId) {
    const numero = extrairNumero(senderId);
    return USUARIOS_AUTORIZADOS[numero]?.saudacao || 'Oie, pronto para estudar? 📚';
}

function salvarDados() {
    try {
        const data = {
            usuarios: USUARIOS_AUTORIZADOS,
            simulados: simuladosRealizados,
            flashcards: flashcardsRespondidos,
            progresso: progressoDiario,
            metas: metasEstudo,
            estatisticas: estatisticasErro,
            planos: planosEstudo
        };
        fs.writeFileSync('./estudos_data.json', JSON.stringify(data, null, 2));
        console.log('💾 Dados salvos com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
    }
}

// Carregar dados
try {
    if (fs.existsSync('./estudos_data.json')) {
        const data = JSON.parse(fs.readFileSync('./estudos_data.json', 'utf8'));
        Object.assign(USUARIOS_AUTORIZADOS, data.usuarios || {});
        console.log('✅ Dados carregados com sucesso!');
    }
} catch (error) {
    console.log('⚠️ Nenhum dado anterior encontrado, iniciando novo...');
}// ========= ESTRUTURAS DE DADOS GLOBAIS ==========
const cacheRespostas = {};
const historicoTopicos = {};
const flashcardsGerados = {};
const flashcardsRespondidos = {};
const simuladosRealizados = {};
const metasEstudo = {};
const lembretesAtivos = {};
const historicoLembretes = {};
const estatisticasErro = {};
const planosEstudo = {};
const estudandoMateria = {};
const testesAtivos = {};
const miniTestesAtivos = {};
const simuladosAtivos = {};
const progressoDiario = {};
const recompensas = {};
const materiaAtual = {};
const tutores = {};
const pedidosAjuda = {};
const questoesComunidade = {};
const duelos = {};
const ultimoEstudo = {};// ========= FUNÇÕES GEMINI ==========
async function chamarGemini(prompt, temperatura = 0.7, usarCache = true) {
    try {
        if (usarCache) {
            const chave = prompt.toLowerCase().trim();
            if (cacheRespostas[chave] && (Date.now() - cacheRespostas[chave].timestamp < 7 * 24 * 60 * 60 * 1000)) {
                console.log('📦 Usando resposta em cache');
                return cacheRespostas[chave].resposta;
            }
        }

        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: temperatura,
                    maxOutputTokens: 2000,
                    topP: 0.95,
                    topK: 40
                }
            },
            { timeout: 30000 }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const resposta = response.data.candidates[0].content.parts[0].text;
            
            if (usarCache) {
                const chave = prompt.toLowerCase().trim();
                cacheRespostas[chave] = {
                    resposta: resposta,
                    timestamp: Date.now()
                };
            }
            return resposta;
        }
        throw new Error('Resposta inválida da API');
    } catch (error) {
        console.error('❌ Erro Gemini:', error.response?.data || error.message);
        return null;
    }
}

async function pesquisarComGemini(pergunta, contexto = '', nivel = 'medio') {
    const niveisPrompt = {
        'facil': 'Use linguagem simples, analogias do dia a dia, exemplos práticos.',
        'medio': 'Use terminologia adequada, nível de 11ª/12ª classe.',
        'dificil': 'Aprofunde conceitos, use terminologia técnica, prepare para exame.'
    };

    const prompt = `${niveisPrompt[nivel] || niveisPrompt.medio}\n\n${contexto ? `Contexto: ${contexto}\n` : ''}\nPergunta: ${pergunta}\n\nResponda de forma educacional e clara:`;
    return await chamarGemini(prompt);
}// ========= CALCULADORA ==========
function calculadoraCientifica(expressao) {
    try {
        let expr = expressao.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/,/g, '.')
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/\^/g, '**')
            .replace(/√|raiz\(/g, 'Math.sqrt(')
            .replace(/sen\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tg\(|tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/π|pi/g, 'Math.PI')
            .replace(/euler|e/g, 'Math.E')
            .replace(/²/g, '**2')
            .replace(/³/g, '**3');

        if (/[a-zA-Z]/.test(expr) && !/Math|PI|E/.test(expr)) {
            return { erro: true, mensagem: '❌ Use apenas números e operadores válidos!' };
        }

        const resultado = eval(expr);
        return {
            sucesso: true,
            expressao: expressao,
            resultado: resultado,
            formatado: typeof resultado === 'number' ? 
                (Number.isInteger(resultado) ? resultado.toString() : resultado.toFixed(6)) : 
                resultado.toString()
        };
    } catch (error) {
        return { erro: true, mensagem: '❌ Erro na expressão! Ex: 2+2, sen(30), √9, 2^3' };
    }
}

function formatarResultadoCalculadora(resultado) {
    if (resultado.erro) return resultado.mensagem;
    return `🧮 *CALCULADORA*\n\n${resultado.expressao} = ${resultado.formatado}`;
}// ========= TABELA PERIÓDICA ==========
const TABELA_PERIODICA = {
    'H': { nome: 'Hidrogênio', nAtomico: 1, massa: 1.008, familia: 'Não metal' },
    'He': { nome: 'Hélio', nAtomico: 2, massa: 4.0026, familia: 'Gás nobre' },
    'Li': { nome: 'Lítio', nAtomico: 3, massa: 6.94, familia: 'Metal alcalino' },
    'Be': { nome: 'Berílio', nAtomico: 4, massa: 9.0122, familia: 'Metal alcalino-terroso' },
    'B': { nome: 'Boro', nAtomico: 5, massa: 10.81, familia: 'Semimetal' },
    'C': { nome: 'Carbono', nAtomico: 6, massa: 12.011, familia: 'Não metal' },
    'N': { nome: 'Nitrogênio', nAtomico: 7, massa: 14.007, familia: 'Não metal' },
    'O': { nome: 'Oxigênio', nAtomico: 8, massa: 15.999, familia: 'Não metal' },
    'F': { nome: 'Flúor', nAtomico: 9, massa: 18.998, familia: 'Halogênio' },
    'Ne': { nome: 'Neônio', nAtomico: 10, massa: 20.180, familia: 'Gás nobre' }
};

function buscarElemento(simbolo) {
    return TABELA_PERIODICA[simbolo] ? { simbolo, ...TABELA_PERIODICA[simbolo] } : null;
}

function formatarElemento(elemento) {
    return `🧪 *${elemento.nome} (${elemento.simbolo})*\n📊 Número atômico: ${elemento.nAtomico}\n⚖️ Massa: ${elemento.massa}\n📌 Família: ${elemento.familia}`;
}// ========= CONVERSOR ==========
const CONVERSORES = {
    'km_m': { fator: 1000, unidade: 'm' },
    'm_km': { fator: 0.001, unidade: 'km' },
    'kg_g': { fator: 1000, unidade: 'g' },
    'g_kg': { fator: 0.001, unidade: 'kg' },
    'l_ml': { fator: 1000, unidade: 'mL' },
    'ml_l': { fator: 0.001, unidade: 'L' },
    'h_min': { fator: 60, unidade: 'min' },
    'min_h': { fator: 1/60, unidade: 'h' },
    'c_f': { converter: (v) => (v * 9/5) + 32, unidade: '°F' },
    'f_c': { converter: (v) => (v - 32) * 5/9, unidade: '°C' }
};

function converterUnidades(valor, de, para) {
    const chave = `${de}_${para}`;
    const conv = CONVERSORES[chave];
    if (!conv) return { erro: true, mensagem: '❌ Conversão não disponível' };
    
    let resultado = conv.converter ? conv.converter(valor) : valor * conv.fator;
    return { sucesso: true, valor, de, para, resultado, unidade: conv.unidade };
}

function formatarConversao(r) {
    if (r.erro) return r.mensagem;
    return `📏 *CONVERSÃO*\n\n${r.valor} ${r.de} = ${r.resultado.toFixed(4)} ${r.unidade}`;
}// ========= DISCIPLINAS ==========
const DISCIPLINAS = {
    'portugues': {
        nome: '🇲🇿 PORTUGUÊS',
        topicos: { '11ª': ['Fonética', 'Morfologia', 'Sintaxe'], '12ª': ['Literatura', 'Redação'] }
    },
    'matematica': {
        nome: '🧮 MATEMÁTICA',
        topicos: { '11ª': ['Funções', 'Geometria'], '12ª': ['Derivadas', 'Limites'] }
    },
    'fisica': {
        nome: '⚛️ FÍSICA',
        topicos: { '11ª': ['Cinemática', 'Dinâmica'], '12ª': ['Termodinâmica', 'Óptica'] }
    },
    'quimica': {
        nome: '🧪 QUÍMICA',
        topicos: { '11ª': ['Átomos', 'Ligações'], '12ª': ['Orgânica', 'Eletroquímica'] }
    },
    'biologia': {
        nome: '🧬 BIOLOGIA',
        topicos: { '11ª': ['Células', 'Tecidos'], '12ª': ['Genética', 'Ecologia'] }
    }
};// ========= COMANDO ESTUDAR ==========
async function processarComandoEstudar(comando, texto, sender, jid, sock) {
    if (comando === 'estudar') {
        let lista = "📚 *ESCOLHA A DISCIPLINA*\n\n";
        Object.entries(DISCIPLINAS).forEach(([key, disc], i) => {
            lista += `${i+1}. ${disc.nome}\n`;
        });
        lista += `\nResponda com o número.`;
        estudandoMateria[sender] = { estado: 'escolhendo_disciplina' };
        await sock.sendMessage(jid, { text: lista });
        return true;
    }
    
    if (estudandoMateria[sender]?.estado === 'escolhendo_disciplina') {
        const num = parseInt(comando);
        const disciplinas = Object.entries(DISCIPLINAS);
        if (isNaN(num) || num < 1 || num > disciplinas.length) {
            await sock.sendMessage(jid, { text: '❌ Número inválido! Digite *estudar* para recomeçar.' });
            delete estudandoMateria[sender];
            return true;
        }
        
        const [disciplinaKey, disciplina] = disciplinas[num - 1];
        estudandoMateria[sender].disciplina = disciplinaKey;
        estudandoMateria[sender].estado = 'escolhendo_classe';
        await sock.sendMessage(jid, { 
            text: `📚 *${disciplina.nome}*\n\nEscolha a classe:\n\n1. 11ª\n2. 12ª\n\nResponda com o número.` 
        });
        return true;
    }    if (estudandoMateria[sender]?.estado === 'escolhendo_classe') {
        const num = parseInt(comando);
        if (num !== 1 && num !== 2) {
            await sock.sendMessage(jid, { text: '❌ Opção inválida! Digite 1 ou 2.' });
            return true;
        }
        
        const classe = num === 1 ? '11ª' : '12ª';
        estudandoMateria[sender].classe = classe;
        estudandoMateria[sender].estado = 'escolhendo_topico';
        
        const disciplina = DISCIPLINAS[estudandoMateria[sender].disciplina];
        let texto = `📚 *${disciplina.nome} - ${classe}*\n\nEscolha o tópico:\n\n`;
        disciplina.topicos[classe].forEach((topico, i) => {
            texto += `${i+1}. ${topico}\n`;
        });
        texto += `\nResponda com o número.`;
        await sock.sendMessage(jid, { text: texto });
        return true;
    }
    
    if (estudandoMateria[sender]?.estado === 'escolhendo_topico') {
        const num = parseInt(comando);
        const disc = estudandoMateria[sender];
        const disciplina = DISCIPLINAS[disc.disciplina];
        const topicos = disciplina.topicos[disc.classe];
        
        if (isNaN(num) || num < 1 || num > topicos.length) {
            await sock.sendMessage(jid, { text: '❌ Número inválido!' });
            return true;
        }
        
        const topico = topicos[num - 1];
        await sock.sendMessage(jid, { text: `🤖 Gerando explicação sobre "${topico}"...` });
        
        const prompt = `Explique "${topico}" da disciplina ${disciplina.nome} (${disc.classe}) de forma simples e didática.`;
        const explicacao = await chamarGemini(prompt);
        
        if (explicacao) {
            materiaAtual[sender] = { disciplina: disc.disciplina, classe: disc.classe, topico, ultimaExplicacao: explicacao, tentativas: 1 };
            await sock.sendMessage(jid, { text: explicacao });
            await sock.sendMessage(jid, { text: `❓ Não entendeu? Digite *naopercebi* para uma explicação diferente.` });
        }
        delete estudandoMateria[sender];
        return true;
    }
    return false;
}// ========= COMANDO NÃOPERCEBI ==========
async function explicarNovamente(userId) {
    const materia = materiaAtual[userId];
    if (!materia) {
        return { erro: true, mensagem: '❌ Nenhuma matéria em estudo. Use *estudar* primeiro.' };
    }

    const disciplina = DISCIPLINAS[materia.disciplina];
    const prompt = `Você já explicou "${materia.topico}" mas o aluno não entendeu. Explique de uma forma DIFERENTE, com linguagem mais simples e exemplos novos.`;
    
    const novaExplicacao = await chamarGemini(prompt, 0.8);
    
    if (novaExplicacao) {
        materia.tentativas++;
        materia.ultimaExplicacao = novaExplicacao;
        return { sucesso: true, explicacao: novaExplicacao, tentativa: materia.tentativas };
    }
    return { erro: true, mensagem: '❌ Erro ao gerar explicação.' };
}

async function processarNaoPercebi(comando, sender, jid, sock) {
    if (comando === 'naopercebi' || comando === 'não percebi') {
        const resultado = await explicarNovamente(sender);
        if (resultado.erro) {
            await sock.sendMessage(jid, { text: resultado.mensagem });
        } else {
            await sock.sendMessage(jid, { 
                text: `🔄 *Tentativa ${resultado.tentativa}*\n\n${resultado.explicacao}` 
            });
        }
        return true;
    }
    return false;
}// ========= LEMBRETES ==========
const mensagensMotivacionais = [
    '🚀 Pequenos passos todos os dias levam a grandes resultados!',
    '📚 O conhecimento de hoje é o sucesso de amanhã!',
    '💪 Estude agora, colha os frutos depois!'
];

function lembreteEstudoDiario(userId, horario) {
    if (!lembretesAtivos[userId]) lembretesAtivos[userId] = [];
    lembretesAtivos[userId].push({ tipo: 'estudo', horario, ativo: true });
    salvarDados();
}

async function verificarLembretes(sock) {
    const agora = new Date();
    const horaAtual = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;
    
    for (const [userId, lembretes] of Object.entries(lembretesAtivos)) {
        for (const lembrete of lembretes) {
            if (lembrete.ativo && lembrete.horario === horaAtual) {
                const jid = userId.includes('@') ? userId : userId + '@s.whatsapp.net';
                const msg = mensagensMotivacionais[Math.floor(Math.random() * mensagensMotivacionais.length)];
                await sock.sendMessage(jid, { text: `⏰ *HORA DE ESTUDAR!*\n\n${msg}\n\nDigite *estudar* para começar.` });
            }
        }
    }
}

async function processarComandosLembrete(comando, texto, sender, jid, sock) {
    if (comando.startsWith('lembrete ')) {
        const horario = texto.split(' ')[1];
        if (!horario || !horario.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) {
            await sock.sendMessage(jid, { text: '❌ Use formato HH:MM (ex: 20:00)' });
            return true;
        }
        lembreteEstudoDiario(sender, horario);
        await sock.sendMessage(jid, { text: `✅ Lembrete diário configurado para ${horario}!` });
        return true;
    }
    return false;
}// ========= FERRAMENTAS ==========
async function processarComandoFerramenta(comando, texto, sender, jid, sock) {
    if (comando.startsWith('/calc ')) {
        const res = calculadoraCientifica(texto.substring(6));
        await sock.sendMessage(jid, { text: formatarResultadoCalculadora(res) });
        return true;
    }
    
    if (comando.startsWith('/elem ')) {
        const simbolo = texto.substring(6).toUpperCase().trim();
        const elem = buscarElemento(simbolo);
        if (!elem) {
            await sock.sendMessage(jid, { text: `❌ Elemento "${simbolo}" não encontrado.` });
            return true;
        }
        await sock.sendMessage(jid, { text: formatarElemento(elem) });
        return true;
    }
    
    if (comando.startsWith('/conv ')) {
        const partes = texto.substring(6).trim().split(' ');
        const valor = parseFloat(partes[0]);
        const de = partes[1]?.toLowerCase();
        const para = partes[2]?.toLowerCase();
        if (isNaN(valor) || !de || !para) {
            await sock.sendMessage(jid, { text: '❌ Use: /conv 10 km m' });
            return true;
        }
        const res = converterUnidades(valor, de, para);
        await sock.sendMessage(jid, { text: formatarConversao(res) });
        return true;
    }
    return false;
}// ========= MENU E PROCESSADOR PRINCIPAL ==========
async function processarMensagem(comando, texto, sender, jid, sock) {
    ultimoEstudo[sender] = Date.now();
    
    if (await processarComandoFerramenta(comando, texto, sender, jid, sock)) return true;
    if (await processarComandoEstudar(comando, texto, sender, jid, sock)) return true;
    if (await processarNaoPercebi(comando, sender, jid, sock)) return true;
    if (await processarComandosLembrete(comando, texto, sender, jid, sock)) return true;
    
    if (comando === 'menu') {
        const menu = `📚 *BOT DE ESTUDOS*\n\n👤 Olá, ${getNomeUsuario(sender)}!\n\n📖 *Comandos:*\n• estudar - Escolher matéria\n• naopercebi - Nova explicação\n• /calc - Calculadora\n• /elem - Tabela periódica\n• /conv - Conversor\n• lembrete HH:MM - Lembrete\n• !ai [pergunta] - Pesquisar\n• menu - Este menu`;
        await sock.sendMessage(jid, { text: menu });
        return true;
    }
    
    if (comando.startsWith('!ai ')) {
        const pergunta = texto.substring(4);
        await sock.sendMessage(jid, { text: '🔍 Pesquisando...' });
        const resposta = await pesquisarComGemini(pergunta);
        await sock.sendMessage(jid, { text: resposta || '❌ Erro na pesquisa' });
        return true;
    }
    return false;
}// ========= INICIALIZAÇÃO ==========
async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })) },
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        logger: pino({ level: 'fatal' })
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(ALOJAMENTO);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`=== CÓDIGO DE PAREAMENTO ===\n${code}\n===========================`);
            } catch (error) {
                console.log('❌ Erro ao gerar código:', error);
            }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const jid = m.key.remoteJid;
        const senderFull = m.key.participant || m.key.remoteJid;
        const sender = extrairNumero(senderFull);
        const texto = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
        const comando = texto.toLowerCase();

        if (!isUsuarioAutorizado(sender)) {
            console.log(`🚫 Mensagem ignorada de: ${sender}`);
            return;
        }

        if (jid.endsWith('@g.us')) {
            console.log(`🚫 Ignorado (grupo): ${jid}`);
            return;
        }

        console.log(`📨 Mensagem de ${getNomeUsuario(sender)}: ${texto}`);
        
        const processado = await processarMensagem(comando, texto, sender, jid, sock);
        if (!processado) {
            await sock.sendMessage(jid, { text: `❓ Comando não reconhecido.\nDigite *menu* para ver as opções.` });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('🔌 Conexão fechada, reconectando...');
            if (shouldReconnect) iniciarBot();
        } else if (connection === 'open') {
            console.log('✅ BOT DE ESTUDOS CONECTADO!');
            console.log('👥 Usuários autorizados:');
            IDs_AUTORIZADOS.forEach(id => {
                console.log(`   • ${USUARIOS_AUTORIZADOS[id].nome}`);
            });
        }
    });

    setInterval(async () => await verificarLembretes(sock), 60 * 1000);
    setInterval(() => { salvarDados(); console.log('💾 Backup automático!'); }, 12 * 60 * 60 * 1000);

    return sock;
}

// ========= INICIAR ==========
iniciarBot().catch(console.error);