import { IndexedData } from 'minecraft-data';
import { parseRecipe } from './RecipeHelper';

export interface SearchDataById {
    id: number
    type: 'item' | 'block' | 'entity' | 'place' | 'recipe' 
}

export interface SearchDataByTerm {
    term: string
    startsWith?: boolean
    endsWith?: boolean
    type: 'item' | 'block' | 'entity' | 'place' | 'recipe'
}

export type SearchData = SearchDataById | SearchDataByTerm

export function searchMcData(mcData: IndexedData, search: SearchData) {
    const choose = ({search, dict, array, id }) => chooseIdOrTerm(search, 
                                                    (s) => searchById(s, id), 
                                                    (s) => searchByTerm(s, dict, array))

    const searchFn = {
        'item': () => choose({ search, dict: mcData.itemsByName, array: mcData.itemsArray, id: mcData.items }),
        'block': () => choose({ search, dict: mcData.blocksByName, array: mcData.blocksArray, id: mcData.blocks }),
        'entity': () =>  choose({ search, dict: mcData.entitiesByName, array: mcData.entitiesArray, id: [] }),
        'recipe': () =>  chooseRecipe({ search, dict: mcData.itemsByName, array: mcData.items, id: mcData.recipes }),
        'place': () => null
    }
    try {
    const blank = () => null
    return (searchFn[search.type] || blank)()
    } catch(e) {
        console.log(e)
        throw new Error('not valid search')
    }
}

function chooseIdOrTerm(search, id, term) {
    if ('id' in search) {
        return id(search)
    }
    if ('term' in search) {
        return term(search)
    }
}

function searchById(search: SearchDataById, array) {
    return array[search.id]
}

function searchByTerm(search: SearchDataByTerm, byName, array) {
    if (!search?.startsWith && !search?.endsWith) {
        return byName[search.term]
    }
    if (search?.startsWith) {
        return array.filter(x => x.name.startsWith(search.term))
    }
    if (search?.endsWith) {
        return array.filter(x => x.name.endsWith(search.term))
    }
}

function chooseRecipe({search, dict, array, id}) {
    const formatRecipe = (recipes) => recipes.map(x=> parseRecipe(x)).map(x=> {
        x.ingredientLookup = Object.keys(x.ingredients).map(i=> array[i])
        return x
    })

    return chooseIdOrTerm(search, (s) => formatRecipe(searchById(s, id)), (s: SearchDataByTerm) => {
        const item = dict[s.term]
        if (!item) {
            return null
        }
        return formatRecipe(id[item.id])
    })
} 