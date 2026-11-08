import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { NicknameForm } from '../components/NicknameForm.tsx'
import { getMarket } from '../lib/api.ts'
import { brl, dateTime } from '../lib/format.ts'
import { cropToJpeg } from '../lib/prepareImage.ts'
import { supabase } from '../lib/supabase.ts'

type Saved = {
  purchase_id: number
  market_id: number
  new_market: boolean
  remembered: number
  classified: number
  market: string
  issued_at: string
  items_count: number
  paid_total: number
  warnings: { code: string; message: string }[]
}

// The screen is a small state machine: each step has only the data it needs.
type Step =
  | { name: 'pick' }
  | { name: 'crop'; url: string }
  | { name: 'sending' }
  | { name: 'saved'; result: Saved; askNickname: boolean }
  | { name: 'failed'; message: string; duplicate: boolean }

const FULL: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

async function errorMessage(error: unknown): Promise<{ message: string; duplicate: boolean }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).json()
      return {
        message: body.message ?? 'Erro ao processar o cupom.',
        duplicate: body.error === 'duplicate',
      }
    } catch {
      // fall through to the generic message
    }
  }
  return {
    message: 'Não foi possível enviar. Verifique a conexão e tente de novo.',
    duplicate: false,
  }
}

export default function UploadPage() {
  const [step, setStep] = useState<Step>({ name: 'pick' })
  const [crop, setCrop] = useState<PercentCrop>(FULL)
  const imageRef = useRef<HTMLImageElement>(null)

  // Object URLs hold the file in memory until revoked; free it when it changes.
  const url = step.name === 'crop' ? step.url : null
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allows picking the same file again
    if (!file) return
    setCrop(FULL)
    setStep({ name: 'crop', url: URL.createObjectURL(file) })
  }

  async function send() {
    const image = imageRef.current
    if (!image) return
    const area = {
      x: (crop.x / 100) * image.naturalWidth,
      y: (crop.y / 100) * image.naturalHeight,
      width: (crop.width / 100) * image.naturalWidth,
      height: (crop.height / 100) * image.naturalHeight,
    }
    if (area.width < 1 || area.height < 1) return

    const blob = await cropToJpeg(image, area)
    setStep({ name: 'sending' })
    const body = new FormData()
    body.append('image', blob, 'cupom.jpg')
    const { data, error } = await supabase.functions.invoke<Saved>('extract-receipt', { body })
    if (error || !data) {
      setStep({ name: 'failed', ...(await errorMessage(error)) })
    } else {
      // RF04: a market without a nickname (new or never named) asks for one.
      const market = await getMarket(data.market_id).catch(() => null)
      setStep({ name: 'saved', result: data, askNickname: market?.nickname === null })
    }
  }

  return (
    <main className="page upload">
      <p>
        <Link to="/">← Início</Link>
      </p>
      <h1>Enviar cupom</h1>

      {step.name === 'pick' && (
        <>
          <p>Use o print da página da SEFAZ ou uma foto do cupom.</p>
          <label className="button">
            Escolher imagem
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        </>
      )}

      {step.name === 'crop' && (
        <>
          <p>
            Ajuste o recorte para <strong>deixar o CPF de fora</strong>. Mantenha o cabeçalho, os
            itens, os totais e a chave de acesso.
          </p>
          <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} keepSelection>
            <img ref={imageRef} src={step.url} alt="Cupom a recortar" />
          </ReactCrop>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep({ name: 'pick' })}>
              Trocar imagem
            </button>
            <button type="button" onClick={send}>
              Enviar
            </button>
          </div>
        </>
      )}

      {step.name === 'sending' && (
        <p className="loading" role="status">
          Lendo o cupom… isso pode levar até dois minutos.
        </p>
      )}

      {step.name === 'saved' && (
        <section className="result" role="status">
          <h2>Compra salva</h2>
          <p>
            <strong>{step.result.market}</strong>
            <br />
            {dateTime(step.result.issued_at)} · {step.result.items_count} itens ·{' '}
            {brl(step.result.paid_total)}
          </p>
          {step.askNickname && (
            <div className="card">
              <p>
                {step.result.new_market ? 'Primeira compra neste mercado!' : 'Mercado sem apelido.'}{' '}
                Como quer chamá-lo?
              </p>
              <NicknameForm
                marketId={step.result.market_id}
                legalName={step.result.market}
                nickname={null}
                onSaved={() => setStep({ ...step, askNickname: false })}
                onCancel={() => setStep({ ...step, askNickname: false })}
              />
            </div>
          )}
          {step.result.warnings.length > 0 && (
            <>
              <p>Confira depois, pode ter havido erro de leitura:</p>
              <ul className="warnings">
                {step.result.warnings.map((warning, index) => (
                  <li key={index}>{warning.message}</li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep({ name: 'pick' })}>
              Enviar outro cupom
            </button>
            <Link className="button" to={`/compras/${step.result.purchase_id}`}>
              Ver compra
            </Link>
          </div>
        </section>
      )}

      {step.name === 'failed' && (
        <section className="result" role="alert">
          <h2>{step.duplicate ? 'Cupom repetido' : 'Não deu certo'}</h2>
          <p className={step.duplicate ? undefined : 'error'}>{step.message}</p>
          <button type="button" onClick={() => setStep({ name: 'pick' })}>
            {step.duplicate ? 'Enviar outro cupom' : 'Tentar de novo'}
          </button>
        </section>
      )}
    </main>
  )
}
