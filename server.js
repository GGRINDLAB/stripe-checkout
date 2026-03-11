require('dotenv').config()

const express = require('express')
const cors = require('cors')
const Stripe = require('stripe')

const app = express()
const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

app.use(cors())
app.use((req, res, next) => {
  if (req.originalUrl === '/stripe-webhook') return next();
  express.json()(req, res, next);
});

app.get('/', (req, res) => {
  res.send('Stripe checkout server is live')
})

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided.' })
    }

    const line_items = items.map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: item.title
        },
        unit_amount: item.price
      },
      quantity: item.quantity
    }))

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,

      shipping_address_collection: {
        allowed_countries: [
          'GB','US','IE','CA','AU','NZ','DE','FR','IT','ES','NL','SE',
          'NO','DK','BE','CH','AT','PT','PL','CZ','HU','RO','BG','HR',
          'GR','FI','LU','MT','CY','EE','LV','LT','SK','SI'
        ]
      },

      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 0,
              currency: 'gbp'
            },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 }
            }
          }
        }
      ],

      phone_number_collection: { enabled: true },

      customer_creation: 'always',

      success_url: 'https://ggrindlab.com/pages/order-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://ggrindlab.com/cart'
    })

    res.json({ url: session.url })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

const port = process.env.PORT || 3000

app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {

    if (event.type === 'checkout.session.completed') {

      const session = event.data.object

      console.log('✅ Payment completed for session:', session.id)

      const shop = process.env.SHOPIFY_STORE_DOMAIN
      const clientId = process.env.SHOPIFY_CLIENT_ID
      const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

      try {

        const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret
          })
        })

        const tokenData = await tokenResponse.json()

        console.log('🟢 Shopify token response:', tokenData)

      } catch (err) {

        console.error('❌ Shopify token request failed:', err)

      }

    }

    res.json({ received: true })

  } catch (err) {

    console.error('Webhook handler failed:', err)
    res.status(500).json({ error: 'Webhook handler failed' })

  }

})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})