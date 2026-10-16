import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Chip, Segmented, styles, T } from "~/components/ui";
import { CONDITION_OPTIONS, LANGUAGE_OPTIONS } from "~/lib/copies";
import {
  ADDED_OPTIONS,
  COLOR_KEYS,
  COLOR_NAMES,
  RARITY_OPTIONS,
  ROLE_OPTIONS,
  SUPERTYPE_OPTIONS,
  TYPE_OPTIONS,
  type Filters,
  type Range,
} from "~/lib/collection-filters";
import { colors, manaColors } from "~/lib/theme";

/** Quita o pone `v` en la lista. */
const toggle = <K,>(list: readonly K[], v: K): K[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="label">{label}</T>
      {children}
    </View>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

function TextBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={colors.text3}
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      style={[styles.field, { flex: 1, height: 44 }]}
    />
  );
}

/** «desde – hasta», los dos opcionales. */
function RangeRow({
  value,
  onChange,
  label,
  decimal,
}: {
  value: Range;
  onChange: (r: Range) => void;
  label: string;
  decimal?: boolean;
}) {
  const kb = decimal ? "decimal-pad" : "numbers-and-punctuation";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TextInput
        accessibilityLabel={`${label}: desde`}
        placeholder="Desde"
        placeholderTextColor={colors.text3}
        keyboardType={kb}
        value={value.min}
        onChangeText={(min) => onChange({ ...value, min })}
        style={[styles.field, { flex: 1, height: 44 }]}
      />
      <T variant="small">–</T>
      <TextInput
        accessibilityLabel={`${label}: hasta`}
        placeholder="Hasta"
        placeholderTextColor={colors.text3}
        keyboardType={kb}
        value={value.max}
        onChangeText={(max) => onChange({ ...value, max })}
        style={[styles.field, { flex: 1, height: 44 }]}
      />
    </View>
  );
}

/**
 * Lo de dentro de la hoja «Filtrar», como en ManaBox: la carta (colores, tipos, texto, coste,
 * fuerza…) y, en la colección, mis copias (edición, rareza, estado, idioma, foil, precio…).
 * En el buscador (`catalog`) solo lo que admite: un tipo, una edición y sin datos de copias.
 */
export function FilterSheetBody({
  f,
  set,
  mode,
  sets = [],
}: {
  f: Filters;
  set: (patch: Partial<Filters>) => void;
  mode: "collection" | "catalog";
  /** En la colección: mis ediciones (de más a menos copias). */
  sets?: { code: string; name: string | null; copies: number }[];
}) {
  const collection = mode === "collection";
  // Primero las elegidas y luego las de más copias.
  const setChips = [
    ...f.sets.map((code) => sets.find((s) => s.code === code) ?? { code, name: null, copies: 0 }),
    ...sets.filter((s) => !f.sets.includes(s.code)),
  ].slice(0, 60);
  return (
    <>
      <Section label="Colores">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {COLOR_KEYS.map((c) => {
            const on = f.colors.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={COLOR_NAMES[c]}
                accessibilityState={{ selected: on }}
                onPress={() => set({ colors: toggle(f.colors, c) })}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: manaColors[c],
                  opacity: on || f.colors.length === 0 ? 1 : 0.35,
                  borderWidth: on ? 3 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
        </View>
        {f.colors.length > 0 && (
          <>
            <Segmented<Filters["colorMode"]>
              options={[
                { key: "alguno", label: collection ? "Alguno" : "Con estos" },
                { key: "dentro", label: "Caben en" },
                { key: "exacto", label: "Exactos" },
              ]}
              value={f.colorMode}
              onChange={(colorMode) => set({ colorMode })}
            />
            <Segmented<Filters["colorBy"]>
              options={[
                { key: "identity", label: "Identidad" },
                { key: "color", label: "Color de la carta" },
              ]}
              value={f.colorBy}
              onChange={(colorBy) => set({ colorBy })}
            />
          </>
        )}
      </Section>

      <Section label={collection ? "Tipo (alguno de)" : "Tipo"}>
        <Chips>
          {TYPE_OPTIONS.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              active={f.types.includes(t.key)}
              onPress={() =>
                set({
                  types: collection
                    ? toggle(f.types, t.key)
                    : f.types.includes(t.key)
                      ? []
                      : [t.key],
                })
              }
            />
          ))}
        </Chips>
        <Chips>
          {SUPERTYPE_OPTIONS.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              active={f.supertypes.includes(t.key)}
              onPress={() => set({ supertypes: toggle(f.supertypes, t.key) })}
            />
          ))}
        </Chips>
      </Section>

      <Section label="Texto de reglas">
        <TextBox
          label="Texto de reglas"
          placeholder="draw a card, treasure…"
          value={f.text}
          onChange={(text) => set({ text })}
        />
      </Section>
      <Section label="Subtipo y habilidad clave">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextBox
            label="Subtipo"
            placeholder="Elf, Equipment…"
            value={f.subtype}
            onChange={(subtype) => set({ subtype })}
          />
          <TextBox
            label="Habilidad clave"
            placeholder="Flying, Ward…"
            value={f.keyword}
            onChange={(keyword) => set({ keyword })}
          />
        </View>
      </Section>

      <Section label="Valor de maná">
        <RangeRow label="Valor de maná" value={f.cmc} onChange={(cmc) => set({ cmc })} />
      </Section>
      <Section label="Fuerza">
        <RangeRow label="Fuerza" value={f.power} onChange={(power) => set({ power })} />
      </Section>
      <Section label="Resistencia">
        <RangeRow
          label="Resistencia"
          value={f.toughness}
          onChange={(toughness) => set({ toughness })}
        />
      </Section>

      <Section label="Rareza">
        <Chips>
          {RARITY_OPTIONS.map((r) => (
            <Chip
              key={r.key}
              label={r.label}
              active={f.rarities.includes(r.key)}
              onPress={() => set({ rarities: toggle(f.rarities, r.key) })}
            />
          ))}
        </Chips>
      </Section>

      <Section label="Edición">
        {collection ? (
          setChips.length === 0 ? (
            <T variant="small">Aún no se sabe la edición de ninguna copia.</T>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 6 }}
            >
              {setChips.map((s) => (
                <Chip
                  key={s.code}
                  label={s.copies ? `${s.code} · ${s.copies}` : s.code}
                  accessibilityLabel={s.name ?? s.code}
                  active={f.sets.includes(s.code)}
                  onPress={() => set({ sets: toggle(f.sets, s.code) })}
                />
              ))}
            </ScrollView>
          )
        ) : (
          <TextBox
            label="Código de edición"
            placeholder="Código: MH3, CMM…"
            value={f.sets[0] ?? ""}
            onChange={(v) => set({ sets: v.trim() ? [v.trim().toUpperCase()] : [] })}
          />
        )}
      </Section>
      <Section label="Artista">
        <TextBox
          label="Artista"
          placeholder="Nombre del artista"
          value={f.artist}
          onChange={(artist) => set({ artist })}
        />
      </Section>

      <Section label={collection ? "Precio por copia (€)" : "Precio (€)"}>
        <RangeRow decimal label="Precio" value={f.price} onChange={(price) => set({ price })} />
      </Section>

      {collection && (
        <>
          <Section label="Acabado">
            <Segmented<Filters["finish"]>
              options={[
                { key: "", label: "Todas" },
                { key: "foil", label: "★ Foil" },
                { key: "nonfoil", label: "Normal" },
              ]}
              value={f.finish}
              onChange={(finish) => set({ finish })}
            />
          </Section>
          <Section label="Estado">
            <Chips>
              {CONDITION_OPTIONS.map((c) => (
                <Chip
                  key={c.code}
                  label={c.label}
                  active={f.conditions.includes(c.code)}
                  onPress={() => set({ conditions: toggle(f.conditions, c.code) })}
                />
              ))}
            </Chips>
          </Section>
          <Section label="Idioma">
            <Chips>
              {LANGUAGE_OPTIONS.map((l) => (
                <Chip
                  key={l.code}
                  label={l.label}
                  active={f.languages.includes(l.code)}
                  onPress={() => set({ languages: f.languages.includes(l.code) ? [] : [l.code] })}
                />
              ))}
            </Chips>
          </Section>
          <Section label="Copias">
            <Chips>
              <Chip
                label="Repetidas (2+)"
                active={f.quantityMin === 2}
                onPress={() => set({ quantityMin: f.quantityMin === 2 ? null : 2 })}
              />
              <Chip
                label="4 o más"
                active={f.quantityMin === 4}
                onPress={() => set({ quantityMin: f.quantityMin === 4 ? null : 4 })}
              />
              <Chip
                label="Libres (no están en mazos)"
                active={f.use === "libres"}
                onPress={() => set({ use: f.use === "libres" ? "" : "libres" })}
              />
              <Chip
                label="En algún mazo"
                active={f.use === "en-mazos"}
                onPress={() => set({ use: f.use === "en-mazos" ? "" : "en-mazos" })}
              />
            </Chips>
          </Section>
          <Section label="Añadidas en">
            <Chips>
              {ADDED_OPTIONS.map((a) => (
                <Chip
                  key={a.days}
                  label={a.label}
                  active={f.addedWithin === a.days}
                  onPress={() => set({ addedWithin: f.addedWithin === a.days ? null : a.days })}
                />
              ))}
            </Chips>
          </Section>
          <Section label="Rol">
            <Chips>
              {ROLE_OPTIONS.map((r) => (
                <Chip
                  key={r.key}
                  label={r.label}
                  active={f.role === r.key}
                  onPress={() => set({ role: f.role === r.key ? null : r.key })}
                />
              ))}
            </Chips>
          </Section>
        </>
      )}

      <Section label="Otros">
        <Chips>
          <Chip
            label="Puede ser comandante"
            active={f.commander}
            onPress={() => set({ commander: !f.commander })}
          />
          <Chip
            label="Game changers"
            active={f.gameChanger}
            onPress={() => set({ gameChanger: !f.gameChanger })}
          />
        </Chips>
      </Section>
    </>
  );
}
