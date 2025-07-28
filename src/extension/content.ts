// src/extension/content.ts - Complete version with image upload capabilities
interface VintedSelectors {
  title: string[];
  description: string[];
  price: string[];
  condition: string[];
  category: string[];
  brand: string[];
  isbn: string[];
  photoUpload: string[];
}

interface BookData {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  description: string;
  condition: {
    primary: 'like-new' | 'very-good' | 'good' | 'fair' | 'poor';
    issues: string[];
    customNotes: string;
    generatedDescription: string;
  };
  customNotes: string;
  price: number;
}

interface PhotoData {
  id: string;
  type: 'front' | 'back' | 'spine' | 'damage' | 'other';
  filename: string;
  dataUrl: string;
}

interface ExtensionSettings {
  autoFillTitle: boolean;
  autoFillDescription: boolean;
  includeISBN: boolean;
  useEmojis: boolean;
  debugMode: boolean;
}

class VintedAutofiller {
  private selectors: VintedSelectors = {
    title: [
      'input[placeholder*="White COS Jumper"]',
      'input[name="title"]',
      'input[data-testid="item-title-input"]',
      '#title',
      'input[aria-label*="title" i]'
    ],
    description: [
      'textarea[placeholder*="only worn a few times"]',
      'textarea[name="description"]',
      'textarea[data-testid="item-description-textarea"]',
      '#description',
      'textarea[aria-label*="describe" i]'
    ],
    price: [
      'input[placeholder*="€0.00"]',
      'input[name="price"]',
      'input[data-testid="item-price-input"]',
      '#price',
      'input[type="number"]'
    ],
    condition: [
      'select[name="condition"]',
      'button[data-testid="condition-button"]',
      '#condition',
      'button[aria-label*="condition" i]',
      '.condition-selector'
    ],
    category: [
      'select[name="category"]',
      'button[data-testid="category-button"]',
      '#category',
      'button[aria-label*="category" i]',
      '.category-selector'
    ],
    brand: [
      'input[name="brand"]',
      'input[data-testid="brand-input"]',
      '#brand',
      'input[placeholder*="brand" i]',
      'input[aria-label*="brand" i]'
    ],
    isbn: [
      'input[placeholder*="978-1-4494-8712-6"]',
      'input[name="isbn"]',
      'input[data-testid="isbn-input"]',
      '#isbn',
      'input[aria-label*="isbn" i]'
    ],
    photoUpload: [
      'input[type="file"][accept*="image"]',
      'button[data-testid="upload-photos"]',
      '.upload-photos-button',
      '[data-testid*="photo"]'
    ]
  };
  
  private conditionMapping = {
    'like-new': ['Brand new with tags', 'Like new', 'New'],
    'very-good': ['Very good', 'Excellent', 'Nearly new'],
    'good': ['Good', 'Fine'],
    'fair': ['Satisfactory', 'Fair', 'Acceptable'],
    'poor': ['Poor', 'Damaged']
  };

  private isReady = false;
  private debugMode = false;

  constructor() {
    this.init();
  }

  private init(): void {
    this.log('Initializing Vinted Autofiller with image support...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupAutofiller());
    } else {
      this.setupAutofiller();
    }
  }

  private setupAutofiller(): void {
    if (!this.isVintedListingPage()) {
      this.log('Not on Vinted listing page, skipping initialization');
      return;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    this.addExtensionIndicator();
    this.observePageChanges();
    
    this.isReady = true;
    this.log('Autofiller with image support initialized successfully');
  }

  private handleMessage(request: any, sender: any, sendResponse: (response: any) => void): void {
    this.log('Received message:', request);

    switch (request.action) {
      case 'autofill':
        this.autofillForm(request.book, request.settings)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            this.log('Autofill error:', error);
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'uploadImages':
        this.uploadImages(request.photos)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            this.log('Image upload error:', error);
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'ping':
        sendResponse({ ready: this.isReady });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  /**
   * Main autofill method (enhanced to include images)
   */
  private async autofillForm(book: BookData, settings: ExtensionSettings): Promise<void> {
    this.debugMode = settings.debugMode || false;
    this.log('Starting autofill process for book:', book.title);
    
    try {
      this.showLoadingMessage();
      await this.waitForFormReady();
      
      // Fill form fields
      const steps = [
        () => this.fillTitle(book, settings),
        () => this.fillDescription(book, settings),
        () => this.setCategory(),
        () => this.fillBrand(book),
        () => this.fillISBN(book),
        () => this.setCondition(book.condition.primary),
        () => this.fillPrice(book.price)
      ];

      for (let i = 0; i < steps.length; i++) {
        try {
          this.log(`Executing step ${i + 1}/${steps.length}`);
          await steps[i]();
          await this.sleep(300);
        } catch (error) {
          this.log(`Step ${i + 1} failed:`, error);
        }
      }
      
      this.showSuccessMessage();
      this.log('Autofill completed successfully');
      
    } catch (error) {
      this.log('Autofill failed:', error);
      this.showErrorMessage(`Autofill failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Upload images to Vinted form
   */
  private async uploadImages(photos: PhotoData[]): Promise<void> {
    this.log('Starting image upload process for', photos.length, 'photos');
    
    try {
      this.showLoadingMessage('Uploading images...');
      
      // Convert data URLs to File objects
      const files = await Promise.all(
        photos.map(photo => this.dataUrlToFile(photo.dataUrl, photo.filename))
      );
      
      // Find file input
      const fileInput = this.findFileInput();
      if (!fileInput) {
        throw new Error('Photo upload input not found');
      }

      // Try different upload methods
      const uploadSuccess = await this.tryUploadMethods(fileInput, files);
      
      if (uploadSuccess) {
        this.showSuccessMessage('Images uploaded successfully!');
        this.log('Image upload completed successfully');
      } else {
        throw new Error('All upload methods failed');
      }
      
    } catch (error) {
      this.log('Image upload failed:', error);
      this.showErrorMessage(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Find file input element for photo upload
   */
  private findFileInput(): HTMLInputElement | null {
    const selectors = this.selectors.photoUpload;
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector) as HTMLInputElement;
        if (element && element.type === 'file') {
          this.log('Found file input:', selector);
          return element;
        }
      } catch (error) {
        continue;
      }
    }

    // Look for file inputs more broadly
    const allFileInputs = document.querySelectorAll('input[type="file"]');
    for (const input of allFileInputs) {
      const inputEl = input as HTMLInputElement;
      if (inputEl.accept && inputEl.accept.includes('image')) {
        this.log('Found generic image file input');
        return inputEl;
      }
    }

    return null;
  }

  /**
   * Try different methods to upload files
   */
  private async tryUploadMethods(fileInput: HTMLInputElement, files: File[]): Promise<boolean> {
    const methods = [
      () => this.uploadViaFileInput(fileInput, files),
      () => this.uploadViaDragDrop(files),
      () => this.uploadViaClipboard(files[0]) // Only first image for clipboard
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        this.log(`Trying upload method ${i + 1}/${methods.length}`);
        await methods[i]();
        return true;
      } catch (error) {
        this.log(`Upload method ${i + 1} failed:`, error);
        if (i === methods.length - 1) {
          throw error;
        }
      }
    }
    return false;
  }

  /**
   * Upload via direct file input manipulation
   */
  private async uploadViaFileInput(fileInput: HTMLInputElement, files: File[]): Promise<void> {
    this.log('Attempting direct file input upload');
    
    // Create DataTransfer object
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    
    // Set files to input
    fileInput.files = dt.files;
    
    // Trigger events
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Wait for any processing
    await this.sleep(1000);
    
    // Check if upload was successful (basic check)
    if (fileInput.files && fileInput.files.length > 0) {
      this.log('Direct file input upload appears successful');
      return;
    }
    
    throw new Error('Direct file input upload failed');
  }

  /**
   * Upload via drag and drop simulation
   */
  private async uploadViaDragDrop(files: File[]): Promise<void> {
    this.log('Attempting drag and drop upload');
    
    // Look for drop zone
    const dropZoneSelectors = [
      '[data-testid*="upload"]',
      '.upload-area',
      '.drop-zone',
      '[data-testid*="photo"]',
      'button[data-testid="upload-photos"]'
    ];
    
    let dropZone: HTMLElement | null = null;
    for (const selector of dropZoneSelectors) {
      dropZone = document.querySelector(selector) as HTMLElement;
      if (dropZone) break;
    }
    
    if (!dropZone) {
      throw new Error('Drop zone not found');
    }
    
    // Create DataTransfer with files
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    
    // Create and dispatch drag events
    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt
    });
    
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt
    });
    
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt
    });
    
    dropZone.dispatchEvent(dragEnterEvent);
    await this.sleep(100);
    dropZone.dispatchEvent(dragOverEvent);
    await this.sleep(100);
    dropZone.dispatchEvent(dropEvent);
    
    await this.sleep(1000);
    this.log('Drag and drop upload completed');
  }

  /**
   * Upload via clipboard (single image only)
   */
  private async uploadViaClipboard(file: File): Promise<void> {
    this.log('Attempting clipboard upload');
    
    try {
      // Convert file to blob for clipboard
      const blob = new Blob([file], { type: file.type });
      const clipboardItem = new ClipboardItem({ [file.type]: blob });
      
      await navigator.clipboard.write([clipboardItem]);
      
      // Show instruction to user
      this.showClipboardInstruction();
      
      // Note: This method requires user to manually paste
      // We can't automatically paste, but we prepare the clipboard
      
    } catch (error) {
      throw new Error('Clipboard upload preparation failed');
    }
  }

  /**
   * Convert data URL to File object
   */
  private async dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    try {
      // If it's already a blob URL, fetch it
      if (dataUrl.startsWith('blob:')) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
      }
      
      // If it's a data URL, convert it
      if (dataUrl.startsWith('data:')) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
      }
      
      throw new Error('Unsupported data URL format');
    } catch (error) {
      this.log('Error converting data URL to file:', error);
      throw new Error('Failed to convert image data');
    }
  }

  /**
   * Enhanced form filling methods
   */
  private async fillTitle(book: BookData, settings: ExtensionSettings): Promise<void> {
    if (!settings.autoFillTitle) return;
    
    const title = `${book.title} - ${book.author}`;
    const element = this.findElement(this.selectors.title);
    
    if (element) {
      await this.fillInputField(element as HTMLInputElement, title);
      this.log('Title filled successfully');
    } else {
      throw new Error('Title field not found');
    }
  }

  private async fillDescription(book: BookData, settings: ExtensionSettings): Promise<void> {
    if (!settings.autoFillDescription) return;
    
    const description = this.generateDescription(book, settings);
    const element = this.findElement(this.selectors.description);
    
    if (element) {
      await this.fillTextareaField(element as HTMLTextAreaElement, description);
      this.log('Description filled successfully');
    } else {
      throw new Error('Description field not found');
    }
  }

  private async fillISBN(book: BookData): Promise<void> {
    if (!book.isbn) return;
    
    const element = this.findElement(this.selectors.isbn);
    
    if (element) {
      await this.fillInputField(element as HTMLInputElement, book.isbn);
      this.log('ISBN filled successfully');
    } else {
      this.log('ISBN field not found (optional)');
    }
  }

  private async fillPrice(price: number): Promise<void> {
    if (!price || price <= 0) return;
    
    const element = this.findElement(this.selectors.price);
    
    if (element) {
      await this.fillInputField(element as HTMLInputElement, price.toFixed(2));
      this.log('Price filled successfully');
    } else {
      this.log('Price field not found (optional)');
    }
  }

  private async fillBrand(book: BookData): Promise<void> {
    if (!book.publisher) return;
    
    const element = this.findElement(this.selectors.brand);
    
    if (element) {
      await this.fillInputField(element as HTMLInputElement, book.publisher);
      this.log('Brand filled successfully');
    } else {
      this.log('Brand field not found (optional)');
    }
  }

  private async setCategory(): Promise<void> {
    const element = this.findElement(this.selectors.category);
    
    if (!element) {
      this.log('Category selector not found');
      return;
    }

    if (element.tagName === 'SELECT') {
      await this.setSelectValue(element as HTMLSelectElement, ['Professional & technical', 'Books', 'Literature']);
    } else {
      await this.clickDropdownOption(element, ['Professional & technical', 'Books', 'Literature']);
    }
    
    this.log('Category set successfully');
  }

  private async setCondition(condition: string): Promise<void> {
    const element = this.findElement(this.selectors.condition);
    
    if (!element) {
      this.log('Condition selector not found');
      return;
    }

    const conditionOptions = this.conditionMapping[condition as keyof typeof this.conditionMapping] || ['Good'];
    
    if (element.tagName === 'SELECT') {
      await this.setSelectValue(element as HTMLSelectElement, conditionOptions);
    } else {
      await this.clickDropdownOption(element, conditionOptions);
    }
    
    this.log('Condition set successfully');
  }

  /**
   * Generate enhanced description
   */
  private generateDescription(book: BookData, settings: ExtensionSettings): string {
    const { useEmojis, includeISBN } = settings;
    let description = '';

    if (useEmojis) {
      description += `📚 ${book.title}\n`;
      description += `✍️ by ${book.author}\n`;
      if (book.publisher) description += `🏢 Publisher: ${book.publisher}\n`;
      if (includeISBN && book.isbn) description += `📖 ISBN: ${book.isbn}\n`;
    } else {
      description += `${book.title}\n`;
      description += `by ${book.author}\n`;
      if (book.publisher) description += `Publisher: ${book.publisher}\n`;
      if (includeISBN && book.isbn) description += `ISBN: ${book.isbn}\n`;
    }

    description += '\n';

    if (book.condition) {
      const conditionText = book.condition.generatedDescription;
      description += useEmojis ? `📋 Condition: ${conditionText}\n` : `Condition: ${conditionText}\n`;
      
      if (book.condition.customNotes) {
        description += `Details: ${book.condition.customNotes}\n`;
      }
    }

    if (book.description) {
      description += `\n📝 Description:\n${book.description}\n`;
    }

    if (book.customNotes) {
      description += `\n💭 Notes: ${book.customNotes}\n`;
    }

    description += useEmojis ? 
      '\n📚 Perfect for book lovers!\n📦 Fast shipping from Belgium | 🚭 Smoke-free home' :
      '\nPerfect for book lovers!\nFast shipping from Belgium | Smoke-free home';

    return description;
  }

  /**
   * Utility methods
   */
  private findElement(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector) as HTMLElement;
        if (element && this.isElementVisible(element)) {
          return element;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  private async fillInputField(element: HTMLInputElement, value: string): Promise<void> {
    element.focus();
    element.select();
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    const events = [
      new Event('input', { bubbles: true }),
      new Event('change', { bubbles: true }),
      new Event('blur', { bubbles: true })
    ];
    
    for (const event of events) {
      element.dispatchEvent(event);
      await this.sleep(50);
    }

    this.highlightElement(element);
  }

  private async fillTextareaField(element: HTMLTextAreaElement, value: string): Promise<void> {
    element.focus();
    element.select();
    
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    const events = [
      new Event('input', { bubbles: true }),
      new Event('change', { bubbles: true }),
      new Event('blur', { bubbles: true })
    ];
    
    for (const event of events) {
      element.dispatchEvent(event);
      await this.sleep(50);
    }

    this.highlightElement(element);
  }

  private async setSelectValue(element: HTMLSelectElement, preferredValues: string[]): Promise<void> {
    for (const value of preferredValues) {
      const option = Array.from(element.options).find(opt => 
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase())
      );
      
      if (option) {
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        this.highlightElement(element);
        return;
      }
    }
    
    this.log(`No matching option found for: ${preferredValues.join(', ')}`);
  }

  private async clickDropdownOption(element: HTMLElement, preferredValues: string[]): Promise<void> {
    element.click();
    await this.sleep(500);
    
    const optionSelectors = [
      '[role="option"]',
      '.dropdown-option',
      '[data-testid*="option"]',
      'li[data-value]',
      '.select-option'
    ];
    
    for (const selector of optionSelectors) {
      const options = document.querySelectorAll(selector);
      
      for (const preferredValue of preferredValues) {
        for (const option of options) {
          const text = option.textContent?.toLowerCase() || '';
          if (text.includes(preferredValue.toLowerCase())) {
            (option as HTMLElement).click();
            await this.sleep(200);
            return;
          }
        }
      }
    }
    
    document.body.click();
    this.log(`No matching dropdown option found for: ${preferredValues.join(', ')}`);
  }

  private highlightElement(element: HTMLElement): void {
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;
    
    element.style.border = '2px solid #10b981';
    element.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
    
    setTimeout(() => {
      element.style.border = originalBorder;
      element.style.boxShadow = originalBoxShadow;
    }, 2000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForFormReady(): Promise<void> {
    const maxWaitTime = 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const titleField = this.findElement(this.selectors.title);
      if (titleField && this.isElementVisible(titleField)) {
        this.log('Form is ready');
        return;
      }
      await this.sleep(500);
    }
    
    throw new Error('Form not ready within timeout period');
  }

  private isVintedListingPage(): boolean {
    return window.location.href.includes('vinted.') && 
           window.location.pathname.includes('/items/new');
  }

  private observePageChanges(): void {
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        
        if (this.isVintedListingPage()) {
          this.log('Navigated to listing page, reinitializing...');
          setTimeout(() => this.setupAutofiller(), 1000);
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', () => {
      setTimeout(() => {
        if (this.isVintedListingPage()) {
          this.setupAutofiller();
        }
      }, 500);
    });
  }

  private addExtensionIndicator(): void {
    const existing = document.getElementById('vinted-book-lister-indicator');
    if (existing) {
      existing.remove();
    }

    const indicator = document.createElement('div');
    indicator.id = 'vinted-book-lister-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: none;
        align-items: center;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        cursor: pointer;
        transition: all 0.3s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19V6.2C4 5.0799 4 4.51984 4.21799 4.09202C4.40973 3.71569 4.71569 3.40973 5.09202 3.21799C5.51984 3 6.0799 3 7.2 3H16.8C17.9201 3 18.4802 3 18.908 3.21799C19.2843 3.40973 19.5903 3.71569 19.782 4.09202C20 4.51984 20 5.0799 20 6.2V17H6C4.89543 17 4 17.8954 4 19ZM4 19C4.89543 21 6 21H20M9 7H15M9 11H13"/>
        </svg>
        <span id="indicator-text">Book Lister Ready (Images Supported)</span>
      </div>
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      const indicatorElement = indicator.firstElementChild as HTMLElement;
      if (indicatorElement) {
        indicatorElement.style.display = 'flex';
        setTimeout(() => {
          indicatorElement.style.display = 'none';
        }, 3000);
      }
    }, 1000);
  }

  private showLoadingMessage(message: string = 'Filling form...'): void {
    this.updateIndicator(`⏳ ${message}`, '#f59e0b');
  }

  private showSuccessMessage(message: string = 'Form filled successfully!'): void {
    this.updateIndicator(`✅ ${message}`, '#10b981');
    setTimeout(() => {
      this.hideIndicator();
    }, 4000);
  }

  private showErrorMessage(message: string): void {
    this.updateIndicator(`❌ ${message}`, '#ef4444');
    setTimeout(() => {
      this.hideIndicator();
    }, 6000);
  }

  private showClipboardInstruction(): void {
    this.updateIndicator('📋 Image copied - paste manually (Ctrl+V)', '#8b5cf6');
    setTimeout(() => {
      this.hideIndicator();
    }, 8000);
  }

  private updateIndicator(text: string, color: string): void {
    const indicator = document.querySelector('#vinted-book-lister-indicator > div') as HTMLElement;
    const textElement = document.getElementById('indicator-text');
    
    if (indicator && textElement) {
      indicator.style.background = color;
      indicator.style.display = 'flex';
      textElement.textContent = text;
    }
  }

  private hideIndicator(): void {
    const indicator = document.querySelector('#vinted-book-lister-indicator > div') as HTMLElement;
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[Vinted Book Lister] ${message}`, data || '');
    }
  }

  // Public methods for debugging
  public testSelectors(): Record<string, HTMLElement | null> {
    const results: Record<string, HTMLElement | null> = {};
    
    Object.entries(this.selectors).forEach(([key, selectors]) => {
      results[key] = this.findElement(selectors);
    });
    
    return results;
  }

  public getPageInfo(): any {
    return {
      url: window.location.href,
      isListingPage: this.isVintedListingPage(),
      ready: this.isReady,
      selectors: this.testSelectors()
    };
  }
}

// Enhanced error handling and retry logic
class AutofillError extends Error {
  public code: string;
  public retryable: boolean;
  
  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'AutofillError';
    this.code = code;
    this.retryable = retryable;
  }
}

// Initialize when DOM is ready
let autofiller: VintedAutofiller | null = null;

function initializeAutofiller() {
  try {
    if (!autofiller) {
      autofiller = new VintedAutofiller();
      
      // Make available for debugging
      (window as any).vintedAutofiller = autofiller;
    }
  } catch (error) {
    console.error('[Vinted Book Lister] Initialization failed:', error);
  }
}

// Initialize based on document state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAutofiller);
} else {
  initializeAutofiller();
}

// Handle extension updates/reloads
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content-script') {
    port.onDisconnect.addListener(() => {
      // Cleanup if needed
      autofiller = null;
    });
  }
});

// Handle page navigation in SPAs
window.addEventListener('popstate', () => {
  setTimeout(() => {
    if (window.location.href.includes('vinted.') && window.location.pathname.includes('/items/new')) {
      initializeAutofiller();
    }
  }, 500);
});

// Monitor for dynamic content changes
const pageObserver = new MutationObserver((mutations) => {
  let shouldReinit = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // Check if form elements were added
          if (element.querySelector('input, textarea, select') || 
              element.matches('input, textarea, select')) {
            shouldReinit = true;
          }
        }
      });
    }
  });
  
  if (shouldReinit && window.location.href.includes('vinted.') && 
      window.location.pathname.includes('/items/new')) {
    setTimeout(initializeAutofiller, 1000);
  }
});

// Start observing
if (document.body) {
  pageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Export for testing purposes
export { VintedAutofiller, AutofillError };