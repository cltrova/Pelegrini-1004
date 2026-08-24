import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

export interface DocumentItem {
  cod_produto?: string;
  produto: string;
  quantidade: number;
  custo_unitario?: number;
  subtotal?: number;
  marca?: string;
  grupo?: string;
  observacao?: string;
}

export interface DocumentData {
  tipo: 'pedido_compra' | 'relatorio_estoque' | 'relatorio_giro' | 'analise_geral';
  titulo: string;
  numero?: string;
  data: string;
  fornecedor?: string;
  solicitante?: string;
  status?: string;
  itens: DocumentItem[];
  total_quantidade?: number;
  total_valor?: number;
  observacoes?: string;
  resumo?: string;
  secoes?: { titulo: string; conteudo: string }[];
}

const COLORS = {
  primary: [30, 58, 95] as [number, number, number],
  accent: [217, 119, 6] as [number, number, number],
  headerBg: [30, 58, 95] as [number, number, number],
  headerText: [255, 255, 255] as [number, number, number],
  altRow: [245, 247, 250] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
};

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ===================== PDF =====================
export function generatePDF(doc: DocumentData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 15;

  // Header bar
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 28, 'F');
  pdf.setTextColor(...COLORS.headerText);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(doc.titulo, 14, 12);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (doc.numero) pdf.text(`Nº: ${doc.numero}`, 14, 19);
  pdf.text(`Data: ${doc.data}`, 14, 25);
  if (doc.status) {
    pdf.setTextColor(...COLORS.accent);
    pdf.text(`Status: ${doc.status}`, pageWidth - 14, 19, { align: 'right' });
  }

  y = 35;
  pdf.setTextColor(...COLORS.text);

  // Info block
  const infos: string[] = [];
  if (doc.fornecedor) infos.push(`Fornecedor: ${doc.fornecedor}`);
  if (doc.solicitante) infos.push(`Solicitante: ${doc.solicitante}`);
  if (infos.length) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    infos.forEach(info => {
      pdf.text(info, 14, y);
      y += 5;
    });
    y += 3;
  }

  // Resume
  if (doc.resumo) {
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.muted);
    const lines = pdf.splitTextToSize(doc.resumo, pageWidth - 28);
    pdf.text(lines, 14, y);
    y += lines.length * 4.5 + 4;
    pdf.setTextColor(...COLORS.text);
  }

  // Sections
  if (doc.secoes?.length) {
    doc.secoes.forEach(secao => {
      if (y > 260) { pdf.addPage(); y = 15; }
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(secao.titulo, 14, y);
      y += 5;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(secao.conteudo, pageWidth - 28);
      pdf.text(lines, 14, y);
      y += lines.length * 4.5 + 5;
    });
  }

  // Items table
  if (doc.itens.length > 0) {
    const hasValue = doc.itens.some(i => i.custo_unitario != null);
    const head = hasValue
      ? [['Cód.', 'Produto', 'Marca', 'Qtd', 'Custo Unit.', 'Subtotal']]
      : [['Cód.', 'Produto', 'Marca', 'Grupo', 'Qtd']];

    const body = doc.itens.map(item => hasValue
      ? [
          item.cod_produto || '-',
          item.produto,
          item.marca || '-',
          String(item.quantidade),
          item.custo_unitario ? formatCurrency(item.custo_unitario) : '-',
          item.subtotal ? formatCurrency(item.subtotal) : '-',
        ]
      : [
          item.cod_produto || '-',
          item.produto,
          item.marca || '-',
          item.grupo || '-',
          String(item.quantidade),
        ]
    );

    autoTable(pdf, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.headerBg,
        textColor: COLORS.headerText,
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8, textColor: COLORS.text },
      alternateRowStyles: { fillColor: COLORS.altRow },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 2 },
    });

    y = (pdf as any).lastAutoTable.finalY + 6;

    // Totals
    if (doc.total_quantidade != null || doc.total_valor != null) {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(14, y - 2, pageWidth - 28, 8, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const totals: string[] = [];
      if (doc.total_quantidade != null) totals.push(`Total: ${doc.total_quantidade} unidades`);
      if (doc.total_valor != null) totals.push(formatCurrency(doc.total_valor));
      pdf.text(totals.join('  |  '), 16, y + 3);
      y += 12;
    }
  }

  // Observations
  if (doc.observacoes) {
    if (y > 260) { pdf.addPage(); y = 15; }
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(...COLORS.muted);
    pdf.text('Observação:', 14, y);
    y += 4;
    const lines = pdf.splitTextToSize(doc.observacoes, pageWidth - 28);
    pdf.text(lines, 14, y);
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Página ${i}/${totalPages}`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
  }

  const filename = `${doc.tipo}_${doc.numero || new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}

// ===================== DOCX =====================
export async function generateDOCX(doc: DocumentData) {
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const children: any[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: doc.titulo, bold: true, size: 32, font: 'Arial' })],
  }));

  // Meta info
  const metaLines: string[] = [];
  if (doc.numero) metaLines.push(`Nº: ${doc.numero}`);
  metaLines.push(`Data: ${doc.data}`);
  if (doc.fornecedor) metaLines.push(`Fornecedor: ${doc.fornecedor}`);
  if (doc.solicitante) metaLines.push(`Solicitante: ${doc.solicitante}`);
  if (doc.status) metaLines.push(`Status: ${doc.status}`);

  metaLines.forEach(line => {
    children.push(new Paragraph({
      children: [new TextRun({ text: line, size: 20, font: 'Arial' })],
      spacing: { after: 60 },
    }));
  });

  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Resume
  if (doc.resumo) {
    children.push(new Paragraph({
      children: [new TextRun({ text: doc.resumo, size: 20, font: 'Arial', italics: true, color: '666666' })],
      spacing: { after: 200 },
    }));
  }

  // Sections
  if (doc.secoes?.length) {
    doc.secoes.forEach(secao => {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: secao.titulo, bold: true, size: 26, font: 'Arial' })],
        spacing: { before: 200 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: secao.conteudo, size: 20, font: 'Arial' })],
        spacing: { after: 200 },
      }));
    });
  }

  // Items table
  if (doc.itens.length > 0) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Itens', bold: true, size: 26, font: 'Arial' })],
      spacing: { before: 200 },
    }));

    const hasValue = doc.itens.some(i => i.custo_unitario != null);
    const headers = hasValue
      ? ['Cód.', 'Produto', 'Marca', 'Qtd', 'Custo Unit.', 'Subtotal']
      : ['Cód.', 'Produto', 'Marca', 'Grupo', 'Qtd'];

    const colWidths = hasValue
      ? [1200, 3200, 1400, 800, 1400, 1400]
      : [1200, 3600, 1600, 1600, 1000];

    const headerRow = new TableRow({
      children: headers.map((h, i) => new TableCell({
        borders: cellBorders,
        width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: '1E3A5F', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, size: 18, font: 'Arial', color: 'FFFFFF' })],
          alignment: AlignmentType.CENTER,
        })],
      })),
    });

    const dataRows = doc.itens.map((item, idx) => {
      const cells = hasValue
        ? [item.cod_produto || '-', item.produto, item.marca || '-', String(item.quantidade), item.custo_unitario ? formatCurrency(item.custo_unitario) : '-', item.subtotal ? formatCurrency(item.subtotal) : '-']
        : [item.cod_produto || '-', item.produto, item.marca || '-', item.grupo || '-', String(item.quantidade)];

      return new TableRow({
        children: cells.map((c, i) => new TableCell({
          borders: cellBorders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: idx % 2 === 1 ? { fill: 'F5F7FA', type: ShadingType.CLEAR } : undefined,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            children: [new TextRun({ text: c, size: 18, font: 'Arial' })],
          })],
        })),
      });
    });

    children.push(new Table({
      width: { size: 9400, type: WidthType.DXA },
      columnWidths: colWidths,
      rows: [headerRow, ...dataRows],
    }));

    // Totals
    if (doc.total_quantidade != null || doc.total_valor != null) {
      const parts: string[] = [];
      if (doc.total_quantidade != null) parts.push(`Total: ${doc.total_quantidade} unidades`);
      if (doc.total_valor != null) parts.push(formatCurrency(doc.total_valor));
      children.push(new Paragraph({
        children: [new TextRun({ text: parts.join('  |  '), bold: true, size: 22, font: 'Arial' })],
        spacing: { before: 120 },
      }));
    }
  }

  // Observations
  if (doc.observacoes) {
    children.push(new Paragraph({ spacing: { before: 200 }, children: [] }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Observação: ', bold: true, size: 20, font: 'Arial', italics: true }),
        new TextRun({ text: doc.observacoes, size: 20, font: 'Arial', italics: true, color: '666666' }),
      ],
    }));
  }

  // Footer
  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Gerado em ${new Date().toLocaleString('pt-BR')}`, size: 16, font: 'Arial', color: '999999', italics: true })],
    alignment: AlignmentType.CENTER,
  }));

  const docx = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(docx);
  const filename = `${doc.tipo}_${doc.numero || new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(buffer, filename);
}
