(() => {
  // Alteração somente visual: nenhum evento de edição ou gravação no servidor.
  const safe = new Set(`Rovva|Ro|vv|a|S|Pular para conteúdo|Dashboard|Vendas|Buscar Empresas|Funil|WhatsApp|Agenda|Pedidos|E-mail|Cadastros|Clientes|Contatos|Mostruário|Representadas|Private Labels|Carteiras|Logística|Rotas|Transportadoras|Financeiro|Comissões|Relatórios|Sistema|Config|Vendedores|Grupos Usuários|Logs|Funil de vendas|Arraste os cards ou use o botão → para mover entre etapas.|Filtros|Indicadores|Todos os vendedores|Demonstração Rovva|Nome / CNPJ|CNAE|Porte|Etapa|Status|Representada|Cenário|Ação (próximo nível)|Private label|Limpar filtros|Buscar|Negócios (filtrados)|Valor em funil|Etapas|Prospecção|Conscientização|Interesse|Avaliação|Negociação|Compra|Fidelização|Solte cards aqui|prospect|Pedido|+Amostra|Dados da empresa|IDENTIFICAÇÃO|Razão social|Nome fantasia|CNPJ|Matriz / Filial|Filial|Matriz|Natureza jurídica|Sociedade Empresária Limitada|Demais|Capital social|ATIVIDADE|CNAE principal|CNAEs secundários|Início de atividade|ENDEREÇO|Endereço|Cidade / UF|Região|SE|Cidade exterior|País|Localização|Investigar de novo|Investigar empresa|Investigar|Investigando…|Investigando...|Buscando…|Carregando…|CONTATO|Telefone 1|Telefone 2|Fax|Site|o registro.br não confirmou agora — investigue de novo|NA INTERNET|Encontrado por nome no Google — confira se é a mesma empresa.|Pessoas no LinkedIn|LinkedIn|Google Maps|Contato|adicionar|+ adicionar|Editar|PRIVATE LABELS|Sem private labels|SITUAÇÃO CADASTRAL|Situação|ativa|Data da situação|Motivo|SEM MOTIVO|Situação especial|Data sit. especial|TRIBUTÁRIO|Opção Simples|Entrada Simples|Saída Simples|MEI|Entrada MEI|Saída MEI|QUADRO SOCIETÁRIO (|OUTROS|Resp. (qualificação)|Sócio-Administrador|Ente federativo|Fonte|rfb|—|·|)|(|★|SOCIO PROPREIETÁRIO|Caixa|Profissional de Alimentos e bebidas|Analista de PCP Sr.|empacotadora.|Todos|Todas|Todas as etapas|Todos os status|Todas as representadas|Todos os cenários|Todas as ações|Todos os portes|Nenhum|Sem ação|Nenhuma|Shimozono|SUPERMERCADO SHIMOZONO LTDA|Supermercado Shimozono Ltda|endereço|cliente|negociacao|perdido`.split('|'));
  const safeLower = new Set([...safe].map(x=>x.toLowerCase()));
  const names = new Map();
  const replacements = new Set();
  function fake(t, el) {
    if(safeLower.has(t.toLowerCase()) || replacements.has(t) || /^Quadro societário/i.test(t)) return t;
    if(/^\d+$/.test(t) && t.length<5) return t;
    if(/^(?:Filtros )?· \d+ ocultos$/.test(t)) return t;
    if(/^[★(]?[\d.]+\s*\(?[\d)]*$/.test(t)) return t;
    if(/^[\w.-]+\.(com|org|info)(\.br)?$/.test(t)) return t;
    if(/^(4711302|4721102) —/.test(t)) return t;
    if(t==='Azul Linhas Aéreas Brasileiras') return 'Analista comercial';
    if(/@/.test(t)) return 'contato@exemplo.invalid';
    if(/\d{2}\.\d{3}\.\d{3}\//.test(t)) return '00.000.000/0001-00';
    if(/^\(\d{2}\)/.test(t)) return '(11) 0000-1234';
    if(/^R\$/.test(t)) return 'R$ 250.000,00';
    if(/investigado em/.test(t)) return 'investigado em 10/10/2026';
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return '15/03/2010';
    if(/^-\d+\.\d+/.test(t)) return '0.00000, 0.00000';
    if(/(?:RICARDO|Ricardo M|CEP |Jardim Nova)/.test(t)) return 'Rua Exemplo, 100 · Bairro Modelo · CEP 00000-000';
    if(/Campinas/.test(t) && t.length<30) return 'Cidade Exemplo · SP';
    if(/\*\*\*|Pessoa física/.test(t)) return 'Sócio-Administrador · Pessoa física · ***000000** · desde 15/03/2010';
    if(/Sabor & Cia/.test(t)) return 'Modelo Representações';
    if(/Embalagens Prátika/.test(t)) return 'Embalagens Modelo';
    if(/Shimozono|shimozono|SHIMOZONO/.test(t) && el.closest('a')) return 'Supermercado Shimozono — página de exemplo';
    if(el.closest('li') && el.tagName==='SPAN' || /(?:HIROSHI|SATICA|TIKARA|VATARI|YUTAKA)/.test(t)) {
      if(!names.has(t)) names.set(t, ['Marina Exemplo','Carlos Modelo','Ana Exemplo','Pedro Modelo','Julia Exemplo','Lucas Modelo','Beatriz Exemplo','Rafael Modelo','Sofia Exemplo'][names.size%9]);
      return names.get(t);
    }
    if(el.closest('option')) return 'Equipe Exemplo';
    if(el.closest('button[title="Ver dados da empresa"]') || /LTDA|COMERCIO|MERCADO|Comércio|Ltda/.test(t)) return 'EMPRESA MODELO LTDA';
    return 'Informação demonstrativa';
  }
  function patch() {
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n;
    while(n=walk.nextNode()) {
      const el=n.parentElement, t=n.nodeValue.trim();
      if(!el||!t||el.closest('script,style,noscript')) continue;
      const v=fake(t,el); if(v!==t) {replacements.add(v);n.nodeValue=n.nodeValue.replace(t,v);}
    }
  }
  patch();
  const observer=new MutationObserver(()=>{observer.disconnect();patch();observer.observe(document.body,{childList:true,subtree:true,characterData:true});});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.rovvaDemo={observer,patch};
  return {mode:'dados fictícios',preserves:'fontes, estilos, elementos e ações'};
})()
