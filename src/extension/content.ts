// src/extension/content.ts
// Content Script for Vinted Integration
interface VintedSelectors {
  title: string;
  description: string;
  price: string;
  condition: string;
  category: string;
  brand: string;
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

interface ExtensionSettings {
  autoFillTitle: boolean;
  autoFillDescription: boolean;
  includeISBN: boolean;
  useEmojis: boolean;
}

class VintedAutofiller {
  private selectors: VintedSelectors = {
    title: 'input[placeholder*="White COS Jumper"], input[name="title"], #title, input[aria-label*="Title"]',
    description: 'textarea[placeholder*="only worn a few times"], textarea[name="description"], #description, textarea[aria-label*="Describe"]',
    price: 'input[placeholder*="€0.00"], input[name="price"], #price, input[type="number"]',
    condition: 'select[name="condition"], #condition, button[aria-label*="condition"], .condition-selector',
    category: 'select[name="category"], #category, button[aria-label*="Category"], .category-selector',
    brand: 'input[name="brand"], #brand, input[placeholder*="brand"], input[aria-label*="Brand"]'
  };
  
  private conditionMapping = {
    'like-new': 'Brand new with tags',
    'very-good': 'Very good',
    'good': 'Good',
    'fair': 'Satisfactory',
    'poor': 'Poor'
  };

  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'autofill') {
        this.autofillForm(request.book, request.settings);
        sendResponse({ success: true });
      }
      return true;
    });

    // Add visual indicator when extension is ready
    this.addExtensionIndicator();
  }

  private async autofillForm(book: BookData, settings: ExtensionSettings): Promise<void> {
    try {
      // Wait for page to be ready
      await this.waitForElement(this.selectors.title);
      
      // Fill title
      if (settings.autoFillTitle && book.title) {
        this.fillInput(this.selectors.title, book.title);
        await this.sleep(200);
      }
      
      // Fill description
      if (settings.autoFillDescription) {
        const description = this.generateDescription(book, settings);
        this.fillTextarea(this.selectors.description, description);
        await this.sleep(200);
      }
      
      // Set category to "Professional & technical" (for books)
      await this.setCategory();
      await this.sleep(300);
      
      // Fill ISBN if available
      if (book.isbn) {
        await this.fillISBN(book.isbn);
        await this.sleep(200);
      }
      
      // Set condition
      if (book.condition) {
        await this.setCondition(book.condition.primary);
        await this.sleep(200);
      }
      
      // Fill price
      if (book.price) {
        this.fillInput(this.selectors.price, book.price.toString());
        await this.sleep(200);
      }
      
      // Show success message
      this.showSuccessMessage();
      
    } catch (error) {
      console.error('Autofill error:', error);
      this.showErrorMessage('Failed to autofill form. Please try again.');
    }
  }

  private fillInput(selector: string, value: string): void {
    const element = this.findElement(selector) as HTMLInputElement;
    if (element) {
      // Clear existing value
      element.value = '';
      element.focus();
      
      // Trigger input events for React/Vue forms
      element.dispatchEvent(new Event('focus', { bubbles: true }));
      
      // Set value using different methods to ensure compatibility
      if (element._valueTracker) {
        element._valueTracker.setValue('');
      }
      
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Add visual highlight
      element.classList.add('vinted-autofilled');
      setTimeout(() => {
        element.classList.remove('vinted-autofilled');
      }, 2000);
    }
  }

  private fillTextarea(selector: string, value: string): void {
    const element = this.findElement(selector) as HTMLTextAreaElement;
    if (element) {
      element.focus();
      
      // Clear and set value for React compatibility
      if ((element as any)._valueTracker) {
        (element as any)._valueTracker.setValue('');
      }
      
      element.value = value;
      
      // Trigger events for React/Vue forms
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Add visual highlight
      element.classList.add('vinted-autofilled');
      setTimeout(() => {
        element.classList.remove('vinted-autofilled');
      }, 2000);
    }
  }

  private async fillISBN(isbn: string): Promise<void> {
    // Look for ISBN field specifically
    const isbnSelectors = [
      'input[placeholder*="978-1-4494-8712-6"]',
      'input[name="isbn"]',
      'input[id*="isbn"]',
      'input[aria-label*="ISBN"]',
      'input[placeholder*="ISBN"]'
    ];
    
    for (const selector of isbnSelectors) {
      const element = document.querySelector(selector) as HTMLInputElement;
      if (element) {
        this.fillInput(selector, isbn);
        return;
      }
    }
    
    console.log('ISBN field not found, but continuing with other fields');
  }

  private async setCategory(): Promise<void> {
    // Look for category dropdown or button
    const categorySelectors = [
      'select[name="category"]',
      'button[aria-label*="Category"]',
      '.category-selector',
      '[data-testid*="category"]'
    ];
    
    let categoryElement: HTMLElement | null = null;
    
    for (const selector of categorySelectors) {
      categoryElement = document.querySelector(selector) as HTMLElement;
      if (categoryElement) break;
    }
    
    if (categoryElement) {
      // If it's a select dropdown
      if (categoryElement.tagName === 'SELECT') {
        const selectElement = categoryElement as HTMLSelectElement;
        
        // Look for "Professional & technical" or similar book-related categories
        const bookCategories = [
          'Professional & technical',
          'Books',
          'Literature',
          'Educational',
          'Reference'
        ];
        
        for (const option of selectElement.options) {
          for (const category of bookCategories) {
            if (option.text.includes(category) || option.value.includes(category.toLowerCase())) {
              selectElement.value = option.value;
              selectElement.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          }
        }
      } else {
        // If it's a button, click it to open dropdown
        categoryElement.click();
        
        await this.sleep(500);
        
        // Look for category options
        const categoryOptions = document.querySelectorAll([
          '[role="option"]',
          '.category-option',
          '[data-testid*="category-option"]',
          'li[data-value]'
        ].join(', '));
        
        for (const option of categoryOptions) {
          const text = option.textContent?.toLowerCase() || '';
          if (text.includes('professional') || text.includes('technical') || text.includes('book')) {
            (option as HTMLElement).click();
            return;
          }
        }
      }
    }
    
    console.log('Category selector not found or no suitable category available');
  }

  private async setCondition(condition: string): Promise<void> {
    const conditionElement = document.querySelector('select[name="condition"], button[aria-label*="condition"], .condition-selector') as HTMLElement;
    
    if (conditionElement) {
      const vintedCondition = this.conditionMapping[condition as keyof typeof this.conditionMapping] || 'Good';
      
      if (conditionElement.tagName === 'SELECT') {
        const selectElement = conditionElement as HTMLSelectElement;
        
        // Look through options
        for (const option of selectElement.options) {
          if (option.text.toLowerCase().includes(vintedCondition.toLowerCase()) || 
              option.value.toLowerCase().includes(vintedCondition.toLowerCase())) {
            selectElement.value = option.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      } else {
        // If it's a button, click to open dropdown
        conditionElement.click();
        
        await this.sleep(500);
        
        const conditionOptions = document.querySelectorAll([
          '[role="option"]',
          '.condition-option',
          '[data-testid*="condition"]',
          'li[data-value]'
        ].join(', '));
        
        for (const option of conditionOptions) {
          const text = option.textContent?.toLowerCase() || '';
          if (text.includes(vintedCondition.toLowerCase())) {
            (option as HTMLElement).click();
            return;
          }
        }
      }
    }
    
    console.log('Condition selector not found or condition not set');
  }

  private generateDescription(book: BookData, settings: ExtensionSettings): string {
    const emoji = settings.useEmojis;
    const includeISBN = settings.includeISBN && book.isbn;
    
    let description = '';
    
    if (emoji) {
      description += `📚 ${book.title}\n`;
      description += `✍️ by ${book.author}\n`;
      if (book.publisher) description += `🏢 Published by ${book.publisher}\n`;
      if (includeISBN) description += `📖 ISBN: ${book.isbn}\n`;
    } else {
      description += `${book.title}\n`;
      description += `by ${book.author}\n`;
      if (book.publisher) description += `Published by ${book.publisher}\n`;
      if (includeISBN) description += `ISBN: ${book.isbn}\n`;
    }
    
    description += '\n';
    
    if (book.condition) {
      const conditionText = this.conditionMapping[book.condition.primary] || 'Good condition';
      description += emoji ? `📋 Condition: ${conditionText}\n` : `Condition: ${conditionText}\n`;
    }
    
    if (book.description) {
      description += `\n📝 Description:\n${book.description}\n`;
    }
    
    if (book.customNotes) {
      description += `\n💭 Notes: ${book.customNotes}\n`;
    }
    
    description += emoji ? 
      '\n📚 Perfect for book lovers!\n📦 Fast shipping | 🚭 Smoke-free home' : 
      '\nPerfect for book lovers!\nFast shipping | Smoke-free home';
    
    return description;
  }

  private findElement(selectors: string): HTMLElement | null {
    const selectorList = selectors.split(', ');
    for (let selector of selectorList) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) return element;
    }
    return null;
  }

  private async waitForElement(selectors: string, timeout: number = 10000): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = this.findElement(selectors);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Element not found within timeout'));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private addExtensionIndicator(): void {
    // Add a small indicator that the extension is active
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
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19V6.2C4 5.0799 4 4.51984 4.21799 4.09202C4.40973 3.71569 4.71569 3.40973 5.09202 3.21799C5.51984 3 6.0799 3 7.2 3H16.8C17.9201 3 18.4802 3 18.908 3.21799C19.2843 3.40973 19.5903 3.71569 19.782 4.09202C20 4.51984 20 5.0799 20 6.2V17H6C4.89543 17 4 17.8954 4 19ZM4 19C4.89543 21 6 21H20M9 7H15M9 11H13"/>
        </svg>
        Book Lister Ready
      </div>
    `;
    
    document.body.appendChild(indicator);
    
    // Show indicator briefly when page loads
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

  private showSuccessMessage(): void {
    this.showMessage('✅ Livre ajouté avec succès! Vérifiez les détails avant de publier.', 'success');
  }

  private showErrorMessage(message: string): void {
    this.showMessage(`❌ ${message}`, 'error');
  }

  private showMessage(text: string, type: 'success' | 'error' = 'success'): void {
    // Remove existing messages
    const existingMessage = document.getElementById('vinted-book-lister-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const message = document.createElement('div');
    message.id = 'vinted-book-lister-message';
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        animation: slideIn 0.3s ease-out;
      ">
        ${text}
      </div>
      <style>
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      </style>
    `;

    document.body.appendChild(message);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.style.transition = 'opacity 0.3s ease-out';
        message.style.opacity = '0';
        setTimeout(() => {
          message.remove();
        }, 300);
      }
    }, 4000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VintedAutofiller();
  });
} else {
  new VintedAutofiller();
}