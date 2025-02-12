import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// message history
let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [
  {
    role: 'assistant',
    content: 'Hello! Our records show that you currently owe $2400. Are you able to resolve this debt today?'
  }
];

// POST /api/chat route
export async function POST(request: Request) {
  try {
    // get message from frontend
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { message: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not set');
      return NextResponse.json(
        { message: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a debt collection chatbot helping users set up payment plans for a person with 2400 of debt.
          
          Rules:
          1. Be brief, empathetic but firm about setting up a payment plan
          2. If they cannot pay in full right now, slowly offer them payment plans with more months and lower monthly payments
          3. Start with a 3-month plan, then 6-month plan, then 9-month, then 12-month plan.
          4. Allow for any plan from 3-12 months, but do not offer more than 12 months.
          5. Do not list out all these plans at once, list them one chat at a time
          6. Minimum monthly payment must be 10% of total debt, cannot offer less than this.
          7. Maximum payment term is 12 months
          8. If user suggests unrealistic terms (like $50/month), explain that this is not possible and legal action will be pursued, 
            if they cannot meet the 12 month plan minimum.
          9. If user persists that they cannot pay any of the plans, say that CollectWise will have to pursure legal action.
          10. When user agrees to a valid payment plan, respond with:
             Great! Here's your payment link to get started: 
             collectwise.com/payments?termLength={termLength}&totalDebtAmount={totalDebtAmount}&termPaymentAmount={termPaymentAmount}
          11. If they can pay in full the $2400, respond with: 
          Great! Here's your payment link to get started: collectwise.com/payments?termLength=1&totalDebtAmount=2400&termPaymentAmount=2400
          12. Any plan within a 1-12 month plan is acceptable as long as the monthly payment is at least 10% ($240) of the total debt ($2400) and 
            the total payments (monthly payment * months in term) match the debt amount (within rounding).
              a.For example, if they suggest an 8-month plan at 300$. That would be fine.

            
          Always suggest specific payment plans.
          
          Never start with a plan longer than 3 months.
          `
        },
        ...conversationHistory
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    const botResponse = completion.choices[0].message.content;

    // bot response to history
    conversationHistory.push({
      role: 'assistant',
      content: botResponse || 'I apologize, but I was unable to generate a response.'
    });

    return NextResponse.json({ message: botResponse });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { message: 'Error processing your message. Please try again.' },
      { status: 500 }
    );
  }
}