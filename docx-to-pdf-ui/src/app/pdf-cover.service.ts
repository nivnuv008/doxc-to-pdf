import { Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

export interface CoverTopHeaderData {
  securityLabel: string;
  unitName: string;
  branchName: string;
  sectionName: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfCoverService {
  private readonly pageWidth = 1240;
  private readonly pageHeight = 1754;
  private emblemImage?: HTMLImageElement | null;

  async prependMockCover(pdfBlob: Blob, topHeaderData: CoverTopHeaderData): Promise<Blob> {
    const sourceBytes = await pdfBlob.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const sourcePageCount = sourcePdf.getPageCount();

    const coverImageBytes = await this.buildOpeningImage(sourcePageCount, topHeaderData);
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

    return this.toPdfBlob(resultPdf);
  }

  async addWatermarkToAllPages(pdfBlob: Blob): Promise<Blob> {
    const sourceBytes = await pdfBlob.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes);
    
    // Create watermark image
    const watermarkImageBytes = await this.buildWatermarkImage();
    const watermarkImage = await sourcePdf.embedPng(watermarkImageBytes);
    
    // Add watermark to all pages
    const pages = sourcePdf.getPages();
    pages.forEach((page) => {
      page.drawImage(watermarkImage, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
      });
    });
    
    return this.toPdfBlob(sourcePdf);
  }

  async appendMockClosingPage(pdfBlob: Blob, topHeaderData: CoverTopHeaderData): Promise<Blob> {
    const sourceBytes = await pdfBlob.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const sourcePageCount = sourcePdf.getPageCount();

    const coverImageBytes = await this.buildClosingImage(sourcePageCount, topHeaderData);
    const resultPdf = await PDFDocument.create();
    const coverImage = await resultPdf.embedPng(coverImageBytes);

    const sourcePages = await resultPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    sourcePages.forEach((page) => resultPdf.addPage(page));

    const coverPage = resultPdf.addPage([595.28, 841.89]);
    coverPage.drawImage(coverImage, {
      x: 0,
      y: 0,
      width: coverPage.getWidth(),
      height: coverPage.getHeight(),
    });

    return this.toPdfBlob(resultPdf);
  }

  private async toPdfBlob(pdfDocument: PDFDocument): Promise<Blob> {
    const mergedBytes = await pdfDocument.save();
    const pdfBuffer = new ArrayBuffer(mergedBytes.byteLength);
    new Uint8Array(pdfBuffer).set(mergedBytes);

    return new Blob([pdfBuffer], { type: 'application/pdf' });
  }

  private async buildOpeningImage(sourcePageCount: number, topHeaderData: CoverTopHeaderData): Promise<Uint8Array> {
    const canvas = document.createElement('canvas');
    canvas.width = this.pageWidth;
    canvas.height = this.pageHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const printDate = this.formatShortDate(new Date());

    this.drawPageFrame(context);
    this.drawTopHeader(context, topHeaderData);
    await this.ensureEmblemLoaded();
    this.drawMainEmblem(context, canvas.width / 2, 340, 0.95);

    const a = 'kfir hatich'

    this.drawCenteredText(context, 'הוראת קהק מצד', canvas.width / 2, 520, '400 30px Arial', '#4b5563');
    this.drawCenteredText(context, a, canvas.width / 2, 575, '700 54px Arial', '#111827');
    this.drawCenteredText(context, 'מהוסבת', canvas.width / 2, 628, '400 24px Arial', '#9ca3af');
    this.drawCenteredText(context, 'מהדורה: 02', canvas.width / 2, 665, '700 24px Arial', '#9ca3af');
    this.drawCenteredText(context, 'מספר הוראה: 102566', canvas.width / 2, 700, '700 30px Arial', '#9ca3af');

    this.drawApprovalBadge(context, canvas.width / 2 - 235, 750, 470, 54);

    this.drawDetailsPanel(context, printDate);
    this.drawContactsSection(context);
    this.drawFooterBand(context, sourcePageCount);
    this.drawWatermark(context);

    return await this.canvasToPngBytes(canvas);
  }

  private async buildClosingImage(sourcePageCount: number, topHeaderData: CoverTopHeaderData): Promise<Uint8Array> {
    const canvas = document.createElement('canvas');
    canvas.width = this.pageWidth;
    canvas.height = this.pageHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const printDate = this.formatShortDate(new Date());

    this.drawPageFrame(context);
    this.drawTopHeader(context, topHeaderData);
    await this.ensureEmblemLoaded();

    this.drawCenteredText(context, 'הוראת קה"ק מצ"ד', canvas.width / 2, 220, '400 52px Arial', '#1f2937');
    this.drawCenteredText(context, 'שם הוראה שם הוראה שם הוראה שם הוראה', canvas.width / 2, 294, '700 66px Arial', '#111827');
    this.drawCenteredText(context, 'מוסבת', canvas.width / 2, 350, '400 30px Arial', '#9ca3af');
    this.drawCenteredText(context, 'מהדורה: 02', canvas.width / 2, 394, '700 32px Arial', '#9ca3af');
    this.drawCenteredText(context, 'מספר הוראה:102566', canvas.width / 2, 438, '700 36px Arial', '#9ca3af');

    this.drawApprovalBadge(context, canvas.width / 2 - 235, 780, 470, 54);

    this.drawContactsSection(context, 1090);
    this.drawCenteredText(context, `פרטי ההוראה נכונים לתאריך ההדפסה: ${printDate}`, this.pageWidth / 2, 1348, '400 22px Arial', '#374151');
    this.drawCenteredText(context, 'דף סגירה', this.pageWidth / 2, 1940 - 440, '700 48px Arial', '#111827');
    this.drawFooterBand(context, sourcePageCount);
    this.drawWatermark(context);

    return await this.canvasToPngBytes(canvas);
  }

  private async ensureEmblemLoaded(): Promise<void> {
    if (this.emblemImage !== undefined) {
      return;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.emblemImage = img;
        resolve();
      };
      img.onerror = () => {
        // mark as null to avoid retrying repeatedly
        this.emblemImage = null;
        resolve();
      };
      // Expect the emblem image to be at `src/assets/IsraeliNavy.png`
      img.src = '/assets/IsraeliNavy.png';
    });
  }

  private drawPageFrame(context: CanvasRenderingContext2D): void {
    context.strokeStyle = '#d1d5db';
    context.lineWidth = 3;
    context.strokeRect(10, 10, this.pageWidth - 20, this.pageHeight - 20);
  }

  private drawTopHeader(context: CanvasRenderingContext2D, topHeaderData: CoverTopHeaderData): void {
    this.drawCenteredText(
      context,
      `-${topHeaderData.securityLabel}-`,
      this.pageWidth / 2,
      78,
      '700 26px Arial',
      '#4b5563',
    );
    this.drawCenteredText(
      context,
      `${topHeaderData.unitName} | ${topHeaderData.branchName} | ${topHeaderData.sectionName}`,
      this.pageWidth / 2,
      132,
      '400 24px Arial',
      '#4b5563',
    );
  }

  private drawApprovalBadge(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    context.fillStyle = '#f3f4f6';
    this.roundRect(context, x, y, width, height, 14, true, false);
    this.drawCenteredText(context, 'לא לשימוש - הוראה טרם מאושרת', x + (width / 2), y + 36, '700 24px Arial', '#1f2937');
  }

  private drawDetailsPanel(context: CanvasRenderingContext2D, printDate: string): void {
    const panelX = 108;
    const panelY = 880;
    const panelWidth = 888;
    const panelHeight = 410;

    context.strokeStyle = '#c7c7c7';
    context.lineWidth = 4;
    context.strokeRect(panelX, panelY, panelWidth, panelHeight);

    const rightX = panelX + panelWidth - 34;
    let currentY = panelY + 58;

    this.drawRightText(context, 'בסיסים:', rightX, currentY, '700 28px Arial', '#111827');
    currentY += 42;
    this.drawRightText(context, 'חדר אוכל', rightX, currentY, '400 26px Arial', '#111827');

    currentY += 52;
    this.drawRightText(context, 'מערכות:', rightX, currentY, '700 28px Arial', '#111827');
    currentY += 42;
    this.drawWrappedRightText(
      context,
      'מערכת השלום, AAA-123-123-123, מערכת AAA-999-000-000 ABX',
      rightX,
      currentY,
      panelWidth - 96,
      38,
      '400 24px Arial',
      '#111827',
    );

    currentY += 84;
    this.drawRightText(context, 'כלים:', rightX, currentY, '700 28px Arial', '#111827');
    currentY += 42;
    this.drawWrappedRightText(
      context,
      'יונאי: 120, אי עשרים: 130, אי שלושים',
      rightX,
      currentY,
      panelWidth - 96,
      38,
      '400 24px Arial',
      '#111827',
    );

    currentY += 76;
    this.drawWrappedRightText(
      context,
      'קלאו: 123, סקו: 234, ספורטאג',
      rightX,
      currentY,
      panelWidth - 96,
      38,
      '400 24px Arial',
      '#111827',
    );

    this.drawCenteredText(context, `פרטי ההוראה נכונים לתאריך ההדפסה: ${printDate}`, this.pageWidth / 2, 1598, '400 22px Arial', '#374151');
  }

  private formatShortDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  }

  private drawContactsSection(context: CanvasRenderingContext2D, startY = 1368): void {
    this.drawCenteredText(context, 'תאריך תפוגה: 12.01.2025', this.pageWidth / 2, startY, '400 26px Arial', '#374151');
    this.drawCenteredText(context, 'אנשי קשר:', this.pageWidth / 2, startY + 50, '400 26px Arial', '#374151');
    this.drawCenteredText(context, 'סבטלנה גרי 0532324567', this.pageWidth / 2, startY + 94, '400 24px Arial', '#374151');
    this.drawCenteredText(context, 'יואב לוי 0546789065', this.pageWidth / 2, startY + 134, '400 24px Arial', '#374151');
    this.drawCenteredText(context, 'שני אלולאי 04392384321', this.pageWidth / 2, startY + 174, '400 24px Arial', '#374151');
  }

  private drawFooterBand(context: CanvasRenderingContext2D, sourcePageCount: number): void {
    const bandY = 1648;
    context.fillStyle = '#f3f4f6';
    context.fillRect(0, bandY, this.pageWidth, 106);

    this.drawMainEmblem(context, 88, bandY + 51, 0.26);
    this.drawMainEmblem(context, this.pageWidth - 88, bandY + 51, 0.26);

    this.drawCenteredText(
      context,
      'קיימים מסמכים מקושרים - ניתן לצפות בהם דרך המערכת',
      this.pageWidth / 2,
      bandY + 42,
      '700 18px Arial',
      '#111827',
    );
    this.drawCenteredText(
      context,
      `מסמך זה מכיל דף פתיחה, ${sourcePageCount} עמודים של הוראה ודף סגירה`,
      this.pageWidth / 2,
      bandY + 74,
      '400 18px Arial',
      '#111827',
    );
  }

  private drawMainEmblem(context: CanvasRenderingContext2D, centerX: number, centerY: number, scale: number): void {
    context.save();
    context.translate(centerX, centerY);
    context.scale(scale, scale);

    // If an emblem image is available in the assets, draw it centered.
    if (this.emblemImage) {
      try {
        const img = this.emblemImage;
        const w = img.naturalWidth || img.width || 200;
        const h = img.naturalHeight || img.height || 200;
        context.drawImage(img, -w / 2, -h / 2, w, h);
        context.restore();
        return;
      } catch (err) {
        // fall through to vector drawing on any error
      }
    }

    context.strokeStyle = '#111827';
    context.fillStyle = '#ffffff';
    context.lineWidth = 8;

    this.drawLeaf(context, -86, 4, -0.7, 1.25);
    this.drawLeaf(context, -44, -34, -0.35, 1.08);
    this.drawLeaf(context, 0, -58, 0, 1.2);
    this.drawLeaf(context, 44, -34, 0.35, 1.08);
    this.drawLeaf(context, 86, 4, 0.7, 1.25);

    context.beginPath();
    context.moveTo(-14, 118);
    context.lineTo(0, -20);
    context.lineTo(14, 118);
    context.stroke();

    context.beginPath();
    context.arc(0, 58, 55, 0.2 * Math.PI, 0.8 * Math.PI, true);
    context.stroke();

    context.beginPath();
    context.arc(0, 58, 34, 0.15 * Math.PI, 0.85 * Math.PI, true);
    context.stroke();

    this.roundRect(context, -74, 124, 148, 36, 10, false, true);
    this.drawCenteredText(context, 'חיל הים', 0, 149, '700 20px Arial', '#111827');

    context.restore();
  }

  private drawLeaf(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    rotation: number,
    stretch: number,
  ): void {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(1, stretch);
    context.beginPath();
    context.moveTo(0, 110);
    context.quadraticCurveTo(-32, 30, -14, -78);
    context.quadraticCurveTo(10, -36, 0, 110);
    context.moveTo(0, 110);
    context.quadraticCurveTo(32, 30, 14, -78);
    context.quadraticCurveTo(-10, -36, 0, 110);
    context.stroke();
    context.restore();
  }

  private drawWrappedRightText(
    context: CanvasRenderingContext2D,
    text: string,
    rightX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    font: string,
    color: string,
  ): void {
    context.save();
    context.font = font;
    context.fillStyle = color;
    context.textAlign = 'right';
    context.direction = 'rtl';

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
        return;
      }

      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    lines.forEach((line, index) => {
      context.fillText(line, rightX, startY + (index * lineHeight));
    });
    context.restore();
  }

  private drawCenteredText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
  ): void {
    context.save();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = color;
    context.font = font;
    context.fillText(text, x, y);
    context.restore();
  }

  private drawRightText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
  ): void {
    context.save();
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = color;
    context.font = font;
    context.fillText(text, x, y);
    context.restore();
  }

  private roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean,
  ): void {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();

    if (fill) {
      context.fill();
    }

    if (stroke) {
      context.stroke();
    }
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

  private drawWatermark(context: CanvasRenderingContext2D): void {
    context.save();

    // Set watermark style
    context.globalAlpha = 0.15;
    context.fillStyle = '#000000';
    context.font = '700 150px Arial';
    context.textAlign = 'center';
    context.direction = 'rtl';

    // Rotate and position watermark diagonally
    context.translate(this.pageWidth / 2, this.pageHeight / 2);
    context.rotate(-Math.PI / 4); // Rotate -45 degrees
    context.fillText('לא לשימוש', 0, 0);

    context.restore();
  }

  private async buildWatermarkImage(): Promise<Uint8Array> {
    const canvas = document.createElement('canvas');
    canvas.width = 595; // A4 width in points converted to pixels
    canvas.height = 842; // A4 height in points converted to pixels
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas 2D context for watermark.');
    }

    // Set transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw watermark
    context.save();
    context.globalAlpha = 0.15;
    context.fillStyle = '#000000';
    context.font = '700 80px Arial';
    context.textAlign = 'center';
    context.direction = 'rtl';
    
    // Rotate and position watermark diagonally
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 4); // Rotate -45 degrees
    context.fillText('לא לשימוש', 0, 0);
    context.restore();

    return this.canvasToPngBytes(canvas);
  }
}