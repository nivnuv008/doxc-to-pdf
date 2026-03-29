import { Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

@Injectable({
  providedIn: 'root',
})
export class PdfCoverService {
  async prependMockCover(pdfBlob: Blob): Promise<Blob> {
    const sourceBytes = await pdfBlob.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const sourcePageCount = sourcePdf.getPageCount();

    const coverImageBytes = await this.buildCoverImage(sourcePageCount);
    const resultPdf = await PDFDocument.create();
    const coverImage = await resultPdf.embedPng(coverImageBytes);

    const coverPage = resultPdf.addPage([595.28, 841.89]);
    coverPage.drawImage(coverImage, {
      x: 0,
      y: 0,
      width: coverPage.getWidth(),
      height: coverPage.getHeight(),
    });

    const sourcePages = await resultPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    sourcePages.forEach((page) => resultPdf.addPage(page));

    const mergedBytes = await resultPdf.save();
    return new Blob([mergedBytes], { type: 'application/pdf' });
  }

  private async buildCoverImage(sourcePageCount: number): Promise<Uint8Array> {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#1f2937';

    context.font = '700 34px Arial';
    context.fillText('הוראת קהק מצד', canvas.width / 2, 120);

    context.font = '700 48px Arial';
    context.fillText('שם הוראה', canvas.width / 2, 200);

    context.fillStyle = '#6b7280';
    context.font = '400 24px Arial';
    context.fillText('מהוסבת', canvas.width / 2, 250);

    context.fillStyle = '#111827';
    context.font = '700 28px Arial';
    context.fillText('לא לשימוש - הוראה טרם מאושרת', canvas.width / 2, 345);

    context.strokeStyle = '#d1d5db';
    context.lineWidth = 4;
    context.strokeRect(120, 420, 1000, 365);

    const details = [
      'בסיסים: חדר אוכל',
      'מערכות: מערכת השלום, AAA-123-123-123, מערכת AAA-999-000-000 ABX',
      'כלים: יונאי 120, אי עשרים 130, אי שלושים',
      'קלאו: 123, סקו: 234',
    ];

    context.textAlign = 'right';
    context.fillStyle = '#111827';
    context.font = '700 28px Arial';
    context.fillText('פרטי מסמך', 1070, 470);

    context.font = '400 24px Arial';
    details.forEach((line, index) => {
      context.fillText(line, 1070, 535 + (index * 54));
    });

    const metadataLines = [
      'מהדורה: 02',
      'מספר הוראה: 102566',
      'תאריך תפוגה: 12.01.2025',
      `מספר עמודים: ${sourcePageCount}`,
    ];

    metadataLines.forEach((line, index) => {
      context.fillText(line, 1070, 900 + (index * 52));
    });

    context.font = '700 28px Arial';
    context.fillText('אנשי קשר', 1070, 1160);

    context.font = '400 24px Arial';
    [
      'סבטלנה גרי 0532324567',
      'יואב לוי 0546789065',
      'שני אלולאי 04392384321',
    ].forEach((line, index) => {
      context.fillText(line, 1070, 1220 + (index * 44));
    });

    context.strokeStyle = '#e5e7eb';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(90, 1670);
    context.lineTo(1150, 1670);
    context.stroke();

    context.textAlign = 'center';
    context.fillStyle = '#374151';
    context.font = '400 22px Arial';
    context.fillText('קיימים מסמכים מקושרים - ניתן לצפות בהם דרך המערכת', canvas.width / 2, 1715);

    return await this.canvasToPngBytes(canvas);
  }

  private async canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error('Failed to export the cover page image.'));
      }, 'image/png');
    });

    return new Uint8Array(await blob.arrayBuffer());
  }
}