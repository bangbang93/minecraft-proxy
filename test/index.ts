import {createClient} from 'minecraft-protocol'

const client = createClient({
  version: '1.8.7',
  username: 'bangbang93',
})

client.connect(25566, 'localhost')
