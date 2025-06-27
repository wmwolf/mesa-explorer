// Text Markup System - LaTeX-style subscript/superscript parsing and SVG rendering
// Supports _{subscript} and ^{superscript} markup with proper tspan rendering

const text_markup = {
    // Parse LaTeX-style markup into structured format
    parse_markup: function(text) {
        if (!text || typeof text !== 'string') {
            return { segments: [{ type: 'text', content: text || '' }] };
        }
        
        const segments = [];
        let currentPos = 0;
        
        // Regex to find _{...} or ^{...} patterns
        const markupRegex = /([_^])\{([^}]*)\}/g;
        let match;
        
        while ((match = markupRegex.exec(text)) !== null) {
            // Add any text before this markup
            if (match.index > currentPos) {
                const beforeText = text.slice(currentPos, match.index);
                if (beforeText) {
                    segments.push({ type: 'text', content: beforeText });
                }
            }
            
            // Add the markup segment
            const markupType = match[1] === '_' ? 'subscript' : 'superscript';
            segments.push({
                type: markupType,
                content: match[2] // Content inside the braces
            });
            
            currentPos = match.index + match[0].length;
        }
        
        // Add any remaining text after the last markup
        if (currentPos < text.length) {
            const remainingText = text.slice(currentPos);
            if (remainingText) {
                segments.push({ type: 'text', content: remainingText });
            }
        }
        
        // If no markup found, return original text as single segment
        if (segments.length === 0) {
            segments.push({ type: 'text', content: text });
        }
        
        return { segments: segments };
    },
    
    // Simple inline replacement approach: replace markup patterns with inline tspans
    render_svg_markup: function(parsedMarkup, parentElement, options = {}) {
        const defaultOptions = {
            fontSize: 12,
            fontFamily: 'sans-serif',
            fill: 'currentColor',
            subscriptScale: 0.75,
            superscriptScale: 0.75,
            subscriptOffset: 4,    // pixels
            superscriptOffset: -6  // pixels
        };
        
        const opts = { ...defaultOptions, ...options };
        
        // Clear existing content
        parentElement.selectAll('tspan').remove();
        parentElement.text('');
        
        // Create the full text content with markup
        const fullText = parsedMarkup.segments.map(segment => {
            if (segment.type === 'subscript') {
                return `_{${segment.content}}`;
            } else if (segment.type === 'superscript') {
                return `^{${segment.content}}`;
            } else {
                return segment.content;
            }
        }).join('');
        
        // Apply inline replacement
        text_markup.apply_inline_markup(parentElement, fullText, opts);
        
        return parentElement;
    },
    
    // Apply inline markup replacement - replace patterns with inline tspans
    apply_inline_markup: function(textElement, text, options = {}) {
        const defaultOptions = {
            fontSize: 12,
            fontFamily: 'sans-serif',
            fill: 'currentColor',
            subscriptScale: 0.75,
            superscriptScale: 0.75,
            subscriptOffset: 4,
            superscriptOffset: -6
        };
        
        const opts = { ...defaultOptions, ...options };
        
        if (!text || !text.match(/[_^]\{[^}]*\}/)) {
            // No markup found, set as simple text
            textElement.text(text);
            return;
        }
        
        // Use innerHTML-style approach by building HTML-like string then parsing
        let htmlContent = text;
        
        // Use baseline-shift for all text (rotation is now handled at group level)
        htmlContent = htmlContent.replace(/\^\{([^}]*)\}/g, (_, content) => {
            return `<tspan baseline-shift="30%" dx="-0.1em" font-size="${opts.fontSize * opts.superscriptScale}">${content}</tspan>`;
        });
        
        htmlContent = htmlContent.replace(/_{([^}]*)}/g, (_, content) => {
            return `<tspan baseline-shift="-30%" dx="-0.1em" font-size="${opts.fontSize * opts.subscriptScale}">${content}</tspan>`;
        });
        
        // Set the HTML-like content (D3 will parse it)
        try {
            textElement.html(htmlContent);
        } catch (error) {
            // Fallback to Unicode if HTML parsing fails
            console.warn('Markup parsing failed, using Unicode fallback:', error);
            text_markup.render_simple_markup(text, textElement);
        }
    },
    
    // Convert existing Unicode notation to LaTeX-style markup
    unicode_to_markup: function(text) {
        if (!text || typeof text !== 'string') {
            return text || '';
        }
        
        let result = text;
        
        // Replace circled dot operator (☉) with proper subscript markup
        result = result.replace(/([MRLmrl])☉/g, '$1_{☉}');
        
        // Replace Unicode superscripts with markup
        const superscriptMap = {
            '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
            '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
        };
        
        // Find sequences of superscript characters and convert them
        const superscriptRegex = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;
        result = result.replace(superscriptRegex, match => {
            const converted = Array.from(match).map(char => superscriptMap[char] || char).join('');
            return `^{${converted}}`;
        });
        
        // Replace Unicode subscripts with markup (if any exist)
        const subscriptMap = {
            '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
            '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
        };
        
        const subscriptRegex = /[₀₁₂₃₄₅₆₇₈₉]+/g;
        result = result.replace(subscriptRegex, match => {
            const converted = Array.from(match).map(char => subscriptMap[char] || char).join('');
            return `_{${converted}}`;
        });
        
        return result;
    },
    
    // Convert LaTeX-style markup to plain text (for input fields, search, etc.)
    markup_to_plain_text: function(text) {
        if (!text || typeof text !== 'string') {
            return text || '';
        }
        
        // Remove markup patterns but keep the content
        return text.replace(/[_^]\{([^}]*)\}/g, '$1');
    },
    
    // Convert LaTeX-style markup to HTML <sup> and <sub> elements
    markup_to_html: function(text) {
        if (!text || typeof text !== 'string') {
            return text || '';
        }
        
        let result = text;
        
        // Replace superscripts: ^{content} → <sup>content</sup>
        result = result.replace(/\^\{([^}]*)\}/g, (_, content) => {
            return `<sup>${content}</sup>`;
        });
        
        // Replace subscripts: _{content} → <sub>content</sub>
        result = result.replace(/_{([^}]*)}/g, (_, content) => {
            return `<sub>${content}</sub>`;
        });
        
        return result;
    },
    
    // Validate markup syntax
    validate_markup: function(text) {
        if (!text || typeof text !== 'string') {
            return { valid: true, errors: [] };
        }
        
        const errors = [];
        
        // Check for unmatched braces
        let braceDepth = 0;
        let inMarkup = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const prevChar = i > 0 ? text[i - 1] : '';
            
            if ((char === '_' || char === '^') && text[i + 1] === '{') {
                inMarkup = true;
                i++; // Skip the opening brace
                braceDepth++;
            } else if (char === '{' && inMarkup) {
                braceDepth++;
            } else if (char === '}' && inMarkup) {
                braceDepth--;
                if (braceDepth === 0) {
                    inMarkup = false;
                }
            }
        }
        
        if (braceDepth !== 0) {
            errors.push('Unmatched braces in markup');
        }
        
        // Check for empty markup
        const emptyMarkupRegex = /[_^]\{\}/g;
        if (emptyMarkupRegex.test(text)) {
            errors.push('Empty markup braces found');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // Helper function to apply markup rendering to axis labels
    update_axis_label_with_markup: function(labelSelector, text, options = {}) {
        const labelElement = d3.select(labelSelector);
        if (labelElement.empty()) return;
        
        const parsedMarkup = text_markup.parse_markup(text);
        text_markup.render_svg_markup(parsedMarkup, labelElement, options);
    },
    
    // Helper function for legend text with markup
    update_legend_text_with_markup: function(legendTextSelection, options = {}) {
        legendTextSelection.each(function(d) {
            const element = d3.select(this);
            const parsedMarkup = text_markup.parse_markup(d.name);
            text_markup.render_svg_markup(parsedMarkup, element, options);
        });
    },
    
    // Add input validation listeners to axis label fields
    setup_markup_validation: function() {
        ['x-axis-label', 'y-axis-label', 'yOther-axis-label'].forEach(fieldId => {
            const field = d3.select(`#${fieldId}`);
            if (field.empty()) return;
            
            // Add tooltip with markup help
            field.attr('title', 'LaTeX-style markup supported: M_{☉} for subscripts, ^{12}C for superscripts');
            
            // Add validation on input
            field.on('input.markup-validation', function() {
                const value = this.value;
                const validation = text_markup.validate_markup(value);
                
                // Update field styling based on validation
                if (validation.valid) {
                    d3.select(this).classed('is-invalid', false).classed('is-valid', false);
                } else {
                    d3.select(this).classed('is-invalid', true).classed('is-valid', false);
                    console.warn(`Markup validation errors in ${fieldId}:`, validation.errors);
                }
            });
        });
    },
    
    // Helper to show markup examples to users
    get_markup_examples: function() {
        return {
            'Solar mass': 'M_{☉}',
            'Solar radius': 'R_{☉}',
            'Solar luminosity': 'L_{☉}',
            'Hydrogen': '^{1}H',
            'Helium-4': '^{4}He',
            'Carbon-12': '^{12}C',
            'Oxygen-16': '^{16}O',
            'Density': 'g/cm^{3}',
            'Energy': 'erg/s',
            'Temperature': 'T_{eff} [K]',
            'Surface gravity': 'log g [cm/s^{2}]',
            'Mixed example': 'L_{H} / L_{☉}'
        };
    },
    
    // Log some helpful examples for users
    show_markup_help: function() {
        console.group('📝 LaTeX-style Markup Help');
        console.log('Mesa Explorer supports LaTeX-style subscripts and superscripts in axis labels:');
        console.log('');
        console.log('Subscripts: Use _{text}');
        console.log('Superscripts: Use ^{text}');
        console.log('');
        console.log('Examples:');
        const examples = text_markup.get_markup_examples();
        Object.entries(examples).forEach(([description, markup]) => {
            console.log(`  ${description}: ${markup}`);
        });
        console.log('');
        console.log('✨ These will render with proper subscripts and superscripts in your plot labels!');
        console.groupEnd();
    },
    
    // Debug function to test markup parsing
    debug_markup: function(text) {
        console.log(`🔍 Debugging markup for: "${text}"`);
        const parsed = text_markup.parse_markup(text);
        console.log('Parsed segments:', parsed.segments);
        return parsed;
    },
    
    // Fallback: Convert LaTeX markup to Unicode characters
    markup_to_unicode: function(text) {
        if (!text || typeof text !== 'string') {
            return text || '';
        }
        
        const superscriptMap = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
        };
        
        const subscriptMap = {
            '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
            '5': '₅', '6': '₆', '7': '₇', '8': '₈', '₉': '₉',
            '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
            'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
            'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ',
            's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
        };
        
        let result = text;
        
        // Replace superscripts: ^{...}
        result = result.replace(/\^\{([^}]*)\}/g, (match, content) => {
            return Array.from(content).map(char => superscriptMap[char] || char).join('');
        });
        
        // Replace subscripts: _{...}
        result = result.replace(/_{([^}]*)}/g, (match, content) => {
            return Array.from(content).map(char => subscriptMap[char] || char).join('');
        });
        
        return result;
    },
    
    // Simple rendering that uses Unicode fallback
    render_simple_markup: function(text, parentElement) {
        if (!text || !parentElement) return;
        
        // Clear existing content
        parentElement.selectAll('tspan').remove();
        parentElement.text('');
        
        // Convert to Unicode and set as simple text
        const unicodeText = text_markup.markup_to_unicode(text);
        parentElement.text(unicodeText);
        
        return parentElement;
    },
    
    // Direct inline markup function for text elements with existing content
    process_existing_markup: function(textElement, options = {}) {
        const defaultOptions = {
            fontSize: 12,
            fontFamily: 'sans-serif',
            fill: 'currentColor',
            subscriptScale: 0.75,
            superscriptScale: 0.75,
            subscriptOffset: 4,
            superscriptOffset: -6
        };
        
        const opts = { ...defaultOptions, ...options };
        
        // Get current text and apply inline replacement
        const currentText = textElement.text();
        text_markup.apply_inline_markup(textElement, currentText, opts);
        
        return textElement;
    }
};