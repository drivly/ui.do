import { describe, it, expect } from 'vitest'
import { renderFormLayerAsText, renderNavigationLayerAsText, renderLayerAsText } from './text-renderer'
import type { IFormLayer, INavigationLayer } from './types'

describe('renderFormLayerAsText', () => {
  it('renders a full form layer', () => {
    const layer: IFormLayer = {
      name: 'customer',
      title: 'Customer Details',
      type: 'formLayer',
      fieldsets: [
        {
          header: 'Contact Information',
          fields: [
            { id: 'name', label: 'Name', type: 'text', required: true },
            { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
            { id: 'phone', label: 'Phone', type: 'text' },
          ],
        },
        {
          header: 'Subscription',
          fields: [
            { id: 'plan', label: 'Plan', type: 'select', options: ['Free', 'Starter', 'Growth', 'Scale'] },
            { id: 'status', label: 'Status', type: 'label', value: 'Active' },
          ],
        },
      ],
      actionButtons: [
        { id: 'upgrade', text: 'Upgrade Plan', address: '/state/Subscription/123/upgrade' },
        { id: 'cancel', text: 'Cancel Subscription', address: '/state/Subscription/123/cancel' },
      ],
      navigation: [
        { text: 'Order History', address: '/orders' },
        { text: 'Support Requests', link: { address: '/support' } },
      ],
    }

    const result = renderFormLayerAsText(layer)

    expect(result).toContain('# Customer Details')
    expect(result).toContain('## Contact Information')
    expect(result).toContain('- Name: [text, required]')
    expect(result).toContain('- Email: [email, required, "you@example.com"]')
    expect(result).toContain('- Phone: [text]')
    expect(result).toContain('## Subscription')
    expect(result).toContain('- Plan: [select: Free, Starter, Growth, Scale]')
    expect(result).toContain('- Status: Active')
    expect(result).toContain('## Actions')
    expect(result).toContain('1. upgrade - Upgrade Plan')
    expect(result).toContain('2. cancel - Cancel Subscription')
    expect(result).toContain('## Related')
    expect(result).toContain('- /orders → Order History')
    expect(result).toContain('- /support → Support Requests')
  })

  it('renders minimal form layer', () => {
    const layer: IFormLayer = {
      name: 'empty',
      title: 'Empty Form',
      type: 'formLayer',
      fieldsets: [],
    }

    const result = renderFormLayerAsText(layer)
    expect(result).toBe('# Empty Form')
  })

  it('renders fieldset footer', () => {
    const layer: IFormLayer = {
      name: 'with-footer',
      title: 'Form',
      type: 'formLayer',
      fieldsets: [{
        header: 'Section',
        footer: 'Required fields marked',
        fields: [{ id: 'f', label: 'Field', type: 'text' }],
      }],
    }

    const result = renderFormLayerAsText(layer)
    expect(result).toContain('_Required fields marked_')
  })

  it('renders all field types', () => {
    const layer: IFormLayer = {
      name: 'all-types',
      title: 'All Types',
      type: 'formLayer',
      fieldsets: [{
        fields: [
          { id: 'a', label: 'Text', type: 'text' },
          { id: 'b', label: 'Email', type: 'email' },
          { id: 'c', label: 'Number', type: 'numeric' },
          { id: 'd', label: 'Pass', type: 'password' },
          { id: 'e', label: 'Notes', type: 'multiline' },
          { id: 'f', label: 'Date', type: 'date' },
          { id: 'g', label: 'Rating', type: 'slider' },
          { id: 'h', label: 'Active', type: 'bool', value: true },
          { id: 'i', label: 'Archived', type: 'bool', value: false },
          { id: 'j', label: 'Status', type: 'label', value: 'OK' },
          { id: 'k', label: 'Tier', type: 'select', options: ['A', 'B'] },
        ],
      }],
    }

    const result = renderFormLayerAsText(layer)
    expect(result).toContain('- Text: [text]')
    expect(result).toContain('- Email: [email]')
    expect(result).toContain('- Number: [numeric]')
    expect(result).toContain('- Pass: [password]')
    expect(result).toContain('- Notes: [multiline]')
    expect(result).toContain('- Date: [date]')
    expect(result).toContain('- Rating: [slider]')
    expect(result).toContain('- [x] Active')
    expect(result).toContain('- [ ] Archived')
    expect(result).toContain('- Status: OK')
    expect(result).toContain('- Tier: [select: A, B]')
  })

  it('renders fields with values', () => {
    const layer: IFormLayer = {
      name: 'values',
      title: 'With Values',
      type: 'formLayer',
      fieldsets: [{
        fields: [
          { id: 'a', label: 'Name', type: 'text', value: 'Alice' },
          { id: 'b', label: 'Plan', type: 'select', value: 'Growth', options: ['Starter', 'Growth', 'Scale'] },
        ],
      }],
    }

    const result = renderFormLayerAsText(layer)
    expect(result).toContain('- Name: Alice [text]')
    expect(result).toContain('- Plan: Growth [select: Starter, Growth, Scale]')
  })
})

describe('renderNavigationLayerAsText', () => {
  it('renders a navigation layer', () => {
    const layer: INavigationLayer = {
      name: 'nav',
      title: 'Dashboard',
      type: 'layer',
      items: [
        {
          type: 'list',
          items: [
            { text: 'Customers', address: '/customers' },
            { text: 'Orders', address: '/orders', subtext: '12 pending' },
          ],
        },
        {
          type: 'list',
          items: [
            { text: 'Settings', link: { address: '/settings' } },
          ],
        },
      ],
    }

    const result = renderNavigationLayerAsText(layer)
    expect(result).toContain('# Dashboard')
    expect(result).toContain('- /customers → Customers')
    expect(result).toContain('- /orders → Orders - 12 pending')
    expect(result).toContain('- /settings → Settings')
  })

  it('renders empty navigation layer', () => {
    const layer: INavigationLayer = {
      name: 'empty',
      title: 'Empty Nav',
      type: 'layer',
      items: [],
    }
    expect(renderNavigationLayerAsText(layer)).toBe('# Empty Nav')
  })
})

describe('renderLayerAsText', () => {
  it('dispatches formLayer', () => {
    const layer: IFormLayer = {
      name: 'f', title: 'Form', type: 'formLayer', fieldsets: [],
    }
    expect(renderLayerAsText(layer)).toBe('# Form')
  })

  it('dispatches navigation layer', () => {
    const layer: INavigationLayer = {
      name: 'n', title: 'Nav', type: 'layer', items: [],
    }
    expect(renderLayerAsText(layer)).toBe('# Nav')
  })
})
