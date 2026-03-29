import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ConversionService } from './conversion.service';
import { PdfCoverService } from './pdf-cover.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  selectedFile: File | null = null;
  isConverting = false;
  errorMessage = '';

  constructor(
    private conversionService: ConversionService,
    private pdfCoverService: PdfCoverService,
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.errorMessage = '';
    }
  }

  onConvert(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a DOCX file first.';
      return;
    }

    this.runConversion(false);
  }

  onConvertWithCover(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a DOCX file first.';
      return;
    }

    this.runConversion(true);
  }

  private runConversion(addCoverPage: boolean): void {
    this.isConverting = true;
    this.errorMessage = '';

    this.conversionService.convertToPdf(this.selectedFile!).subscribe({
      next: async (blob: Blob) => {
        try {
          const outputBlob = addCoverPage
            ? await this.pdfCoverService.prependMockCover(blob)
            : blob;

          this.isConverting = false;
          const url = window.URL.createObjectURL(outputBlob);
          const a = document.createElement('a');
          a.href = url;
          const baseName = this.selectedFile!.name.replace(/\.[^/.]+$/, '');
          a.download = `${baseName || 'document'}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch {
          this.isConverting = false;
          this.errorMessage = 'Creating the cover page failed. Please try again later.';
        }
      },
      error: async (error: HttpErrorResponse) => {
        this.isConverting = false;
        this.errorMessage = await this.getErrorMessage(error);
      },
    });
  }

  private async getErrorMessage(error: HttpErrorResponse): Promise<string> {
    if (error.status === 0) {
      return 'Cannot reach the converter server. Check that the backend is running on http://127.0.0.1:8000.';
    }

    if (error.error instanceof Blob) {
      try {
        const payload = JSON.parse(await error.error.text()) as { detail?: string };
        if (payload.detail) {
          return payload.detail;
        }
      } catch {
        return 'Conversion failed. The server returned an unreadable error.';
      }
    }

    if (typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    return 'Conversion failed. Please try again later.';
  }
}
