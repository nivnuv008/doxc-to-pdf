import { Component } from '@angular/core';
import { ConversionService } from './conversion.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  selectedFile: File | null = null;
  isConverting = false;
  errorMessage = '';

  constructor(private conversionService: ConversionService) {}

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

    this.isConverting = true;
    this.errorMessage = '';

    this.conversionService.convertToPdf(this.selectedFile).subscribe({
      next: (blob: Blob) => {
        this.isConverting = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = this.selectedFile!.name.replace(/\.[^/.]+$/, '');
        a.download = `${baseName || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.isConverting = false;
        this.errorMessage = 'Conversion failed. Please try again later.';
      },
    });
  }
}
