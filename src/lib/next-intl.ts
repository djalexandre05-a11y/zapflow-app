const ptBR: Record<string, any> = {
  "Flows.builder.canvasView": "Quadro Visual",
  "Flows.builder.listView": "Modo Lista",
  "Flows.builder.addNode": "Adicionar Nó",
  "Flows.editorState.modeAdd": "Adicionar",
  "Flows.editorState.modeRemove": "Remover",
  "Flows.editorState.media": "Mídia",
  "Flows.validate.noIssues": "Sem problemas",
  "Flows.validate.summary": "{errorCount} erros e {warningCount} avisos",
  "Flows.nodeTypes.start.label": "Início",
  "Flows.nodeTypes.start.blurb": "Ponto de entrada",
  "Flows.nodeTypes.send_message.label": "Mensagem",
  "Flows.nodeTypes.send_message.blurb": "Enviar texto simples",
  "Flows.nodeTypes.send_buttons.label": "Botões",
  "Flows.nodeTypes.send_buttons.blurb": "Enviar texto com botões interativos",
  "Flows.nodeTypes.send_list.label": "Menu Lista",
  "Flows.nodeTypes.send_list.blurb": "Menu de opções (até 10 itens)",
  "Flows.nodeTypes.send_media.label": "Mídia",
  "Flows.nodeTypes.send_media.blurb": "Imagem, vídeo, áudio ou PDF",
  "Flows.nodeTypes.collect_input.label": "Entrada",
  "Flows.nodeTypes.collect_input.blurb": "Aguardar texto do cliente",
  "Flows.nodeTypes.condition.label": "Condição",
  "Flows.nodeTypes.condition.blurb": "Decidir baseado em variável",
  "Flows.nodeTypes.set_tag.label": "Tag",
  "Flows.nodeTypes.set_tag.blurb": "Adicionar ou remover tag",
  "Flows.nodeTypes.handoff.label": "Atendente",
  "Flows.nodeTypes.handoff.blurb": "Passar para atendimento humano",
  "Flows.nodeTypes.end.label": "Fim",
  "Flows.nodeTypes.end.blurb": "Encerrar o fluxo",
};

export function useTranslations(namespace?: string) {
  const t = (key: string, values?: Record<string, any>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let text = ptBR[fullKey];
    
    if (!text) {
      const parts = key.split('.');
      text = parts[parts.length - 1];
    }

    if (values && text) {
      for (const [k, v] of Object.entries(values)) {
        text = text.replace('{'+k+'}', String(v));
      }
    }
    return text || key;
  };
  t.rich = (key: string, values?: Record<string, any>) => {
    return t(key, values);
  };
  return t;
}
