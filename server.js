require('dotenv').config()

const express = require('express')
const cors = require('cors')
const Stripe = require('stripe')

const app = express()
const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

app.use(cors())
app.use(express.json())

app.post('/create-checkout-session', async (req, res) => {

  const { items } = req.body

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
  line_items,
  mode: 'payment',
  billing_address_collection: 'required',
  shipping_address_collection: {
    allowed_countries: ['GB', 'US', 'IE']
  },
  phone_number_collection: {
    enabled: true
  },
  customer_creation: 'always',
  success_url: 'https://ggrindlab.com',
  cancel_url: 'https://ggrindlab.com/cart'
})

  res.json({ url: session.url })

})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})