/**
 * Cria sermões de demonstração na biblioteca (idempotente).
 * Uso: node scripts/seed-demo.mjs
 */
import { pathToFileURL } from 'node:url';

const BASE = process.env.PULPITO_API || 'http://127.0.0.1:4000/api';

export const SERMONS = [
  {
    title: 'A graça que nos alcança',
    theme: 'A graça que nos encontra onde estamos',
    sections: {
      introduction: {
        html: `<p>Há uma diferença entre ser encontrado e ser procurado. Quando nos perdemos em uma cidade desconhecida, esperamos que alguém nos encontre. Mas a graça de Deus não espera: ela sai ao nosso encontro. Antes que consigamos explicar nossa necessidade, o Pai já está no caminho.</p>
<p>Jesus contou a história de um filho que pediu a herança, desperdiçou tudo e voltou derrotado. O pai não o esperou na porta de casa: <em>correu</em>. Na cultura da época, um homem respeitável não corria. Mas aquele pai correu — e correu para abraçar, não para julgar.</p>
<blockquote>“Mas, quando ainda estava longe, seu pai o viu e, movido de compaixão, correu para ele, abraçou-o e o beijou.” (Lucas 15:20)</blockquote>`,
      },
      developments: [
        {
          title: 'A graça começa em Deus, não em nós',
          html: `<p><strong>Nós gostamos de pensar que a fé é o nosso lado do acordo:</strong> Deus faz a parte dele, nós fazemos a nossa. Mas o evangelho começa com uma iniciativa que não é nossa.</p>
<p>“Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...” (João 3:16). O movimento é de cima para baixo. Não subimos até Deus; Deus desce até nós.</p>
<p>Paulo escreve aos efésios: “Pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus; não por obras, para que ninguém se glorie” (Efésios 2:8-9). A fé é a mão aberta que recebe; a graça é o presente que Deus coloca nela.</p>`,
        },
        {
          title: 'A graça não é barata',
          html: `<p>Há uma versão de graça que não custa nada e não muda nada: um perdão que nunca confronta, um amor que nunca se importa. Essa não é a graça da Bíblia.</p>
<p>A graça é gratuita para nós, mas custou a Deus o que ele tinha de mais precioso. “Mas Deus prova o seu amor para conosco pelo fato de ter Cristo morrido por nós, sendo nós ainda pecadores” (Romanos 5:8).</p>
<blockquote>A cruz não é um símbolo decorativo: é o lugar onde a justiça e a misericórdia se abraçam.</blockquote>
<p>Quando entendemos o preço, deixamos de tratar o pecado como um detalhe e passamos a tratá-lo como aquilo de que precisamos ser salvos.</p>`,
        },
        {
          title: 'A graça nos ensina a viver',
          html: `<p>A graça não termina no perdão; ela começa uma nova obediência. “Porque a graça de Deus se manifestou salvadora a todos os homens, educando-nos para que, renegadas a impiedade e as paixões mundanas, vivamos no presente século sensata, justa e piedosamente” (Tito 2:11-12).</p>
<p>Quem foi perdoado muito, ama muito. A gratidão se torna o motor da santidade. Não obedecemos para sermos amados; obedecemos porque fomos amados.</p>
<p>Isso muda a forma como lidamos com o fracasso: não como quem perdeu o direito de estar aqui, mas como quem foi convidado a recomeçar.</p>`,
        },
      ],
      conclusion: {
        html: `<p>Talvez você tenha chegado aqui cansado de tentar merecer. A boa notícia é que o evangelho nunca foi sobre merecer. É sobre receber.</p>
<p>O pai ainda está correndo. A mesa ainda está posta. A graça não pergunta onde você se perdeu — pergunta apenas se você quer voltar para casa.</p>
<p>Hoje, antes de tentar se limpar para se aproximar, aproxime-se como está. A graça que nos alcança é a mesma que nos transforma.</p>`,
      },
    },
  },
  {
    title: 'O Deus que desce ao encontro',
    theme: 'Encarnação e compaixão',
    sections: {
      introduction: {
        html: `<p>Nós construímos religiões para subir. Escadas, ritos, méritos, caminhos que prometem levar o homem até o divino. O cristianismo anuncia algo diferente: Deus desceu.</p>
<p>“E o Verbo se fez carne e habitou entre nós” (João 1:14). Não um Deus que observa de longe, mas um Deus que entra na fila, sente fome, chora no enterro de um amigo e lava pés sujos.</p>`,
      },
      developments: [
        {
          title: 'A encarnação é o comentário de Deus sobre o sofrimento',
          html: `<p>Quando Deus quis explicar o que sente por nós, não escreveu um tratado. Enviou um Filho. A encarnação é a resposta de Deus ao sofrimento humano — não uma explicação filosófica, mas uma presença.</p>
<p>“Porque não temos um sumo sacerdote que não possa compadecer-se das nossas fraquezas, mas um que, como nós, em tudo foi tentado, mas sem pecado” (Hebreus 4:15). Jesus não apenas conhece a dor; ele a experimentou.</p>`,
        },
        {
          title: 'Compaixão é presença que se suja',
          html: `<p>Compaixão bíblica não é pena à distância. É movimento em direção ao outro. Jesus viu a viúva de Naim, foi tocado de compaixão e tocou o esquife — um gesto que o tornava ritualmente impuro (Lucas 7:13-14).</p>
<p>A compaixão verdadeira sempre custa alguma coisa: tempo, reputação, conforto. O amor que não se aproxima é apenas sentimento.</p>`,
        },
      ],
      conclusion: {
        html: `<p>Se Deus desceu, a igreja não pode viver de cima. Somos chamados a habitar, não apenas a discursar. A mesa do Reino é para os que se sentam com os cansados.</p>
<p>Que a nossa fé tenha o cheiro das casas, não apenas o som dos púlpitos.</p>`,
      },
    },
  },
  {
    title: 'Fé que atravessa o deserto',
    theme: 'Fé provada, esperança viva',
    sections: {
      introduction: {
        html: `<p>A fé não é a ausência do deserto; é a presença de Deus dentro dele. Israel atravessou quarenta anos de areia, e o Senhor não abandonou o povo — caminhou com ele.</p>
<p>Entre o Egito e a promessa existe um lugar incômodo chamado processo. É ali que aprendemos quem Deus é.</p>`,
      },
      developments: [
        {
          title: 'No deserto, Deus sustenta',
          html: `<p>O maná não era estocado: era colhido cada manhã. Deus ensinava o povo a depender dele <em>diariamente</em>. “Nem só de pão viverá o homem, mas de tudo o que procede da boca do Senhor” (Deuteronômio 8:3).</p>
<p>O deserto desmonta a ilusão de autossuficiência. E, no mesmo movimento, revela um Pai que não deixa faltar o essencial.</p>`,
        },
        {
          title: 'No deserto, Deus forma',
          html: `<p>“Meus irmãos, tende por motivo de grande alegria o fato de passarem por diversas provações, sabendo que a prova da vossa fé produz perseverança” (Tiago 1:2-3).</p>
<p>O deserto não é um acidente de percurso: é uma sala de aula. Deus usa o tempo seco para tirar de nós o que não sustenta o peso da promessa.</p>`,
        },
      ],
      conclusion: {
        html: `<p>Se você está no deserto, não conclua que Deus se ausentou. Talvez ele esteja mais perto do que nunca — caminhando no mesmo ritmo que você.</p>
<p>A promessa continua do outro lado. E a fé é o que mantém os pés em movimento quando os olhos ainda não veem o oásis.</p>`,
      },
    },
  },
];

async function main() {
  const listResponse = await fetch(`${BASE}/sermons`);
  if (!listResponse.ok) throw new Error(`API respondeu ${listResponse.status}`);
  const list = await listResponse.json();
  const existingTitles = new Set((list.sermons || []).map((sermon) => sermon.title));

  for (const sermon of list.sermons || []) {
    if (sermon.title === 'Teste') {
      await fetch(`${BASE}/sermons/${sermon.id}`, { method: 'DELETE' });
      console.log('• removido sermão de teste');
    }
  }

  for (const sermon of SERMONS) {
    if (existingTitles.has(sermon.title)) {
      console.log(`• já existe: ${sermon.title}`);
      continue;
    }
    const response = await fetch(`${BASE}/sermons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sermon),
    });
    if (!response.ok) {
      console.error('! falha ao criar', sermon.title, await response.text());
      continue;
    }
    const created = await response.json();
    console.log(`✓ ${created.title} · ${created.metrics.minutes} min · tags: ${created.tags.join(', ')}`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
